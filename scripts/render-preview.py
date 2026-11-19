"""Render the README preview images with Pillow.

This is a documentation asset, not a screenshot: it draws a mock session header
with the same badge layout the plugin renders. Requires Pillow.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
OUT.mkdir(exist_ok=True)

W, H = 1200, 560
BG = (16, 17, 20, 255)
CARD = (25, 26, 30, 255)
CARD_BORDER = (48, 50, 56, 255)
PANEL = (32, 34, 38, 255)
PANEL_BORDER = (52, 55, 61, 255)
BADGE_BG = (42, 44, 49, 255)
BADGE_BORDER = (58, 61, 68, 255)
TEXT = (236, 236, 238, 255)
MUTED = (142, 145, 153, 255)
CAPTION = (201, 203, 209, 255)
ORANGE = (242, 163, 60, 255)
GREEN = (76, 195, 138, 255)


def load_font(candidates, size, index=0):
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size, index=index)
            except OSError:
                continue
    return ImageFont.load_default()


def fonts(language):
    if language == "zh":
        regular = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyh.ttf", r"C:\Windows\Fonts\simhei.ttf"]
        bold = [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyhbd.ttf", r"C:\Windows\Fonts\simhei.ttf"]
    else:
        regular = [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]
        bold = [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]
    return {
        "title": load_font(bold, 30),
        "subtitle": load_font(regular, 15),
        "session": load_font(regular, 18),
        "badge": load_font(regular, 17),
        "caption": load_font(regular, 16),
        "note": load_font(regular, 14),
    }


def render(language, title, subtitle, session_title, peak_badge, off_badge, caption, note):
    f = fonts(language)
    image = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((40, 36, W - 40, H - 36), radius=24, fill=CARD, outline=CARD_BORDER, width=1)
    draw.text((80, 62), title, font=f["title"], fill=TEXT)
    draw.text((80, 106), subtitle, font=f["subtitle"], fill=MUTED)

    def panel(top, badge_text, dot_color):
        left, right = 80, W - 80
        height = 80
        bottom = top + height
        draw.rounded_rectangle((left, top, right, bottom), radius=14, fill=PANEL, outline=PANEL_BORDER, width=1)

        # Collapsed-sidebar glyph, as a hint of the real session header.
        center_y = top + height // 2
        for offset in (-8, 0, 8):
            draw.rounded_rectangle((104, center_y + offset - 1, 126, center_y + offset + 1), radius=1, fill=MUTED)

        draw.text((148, center_y), session_title, font=f["session"], fill=TEXT, anchor="lm")

        dot_radius = 5
        gap = 10
        pad_x = 16
        text_width = draw.textlength(badge_text, font=f["badge"])
        badge_width = pad_x * 2 + dot_radius * 2 + gap + text_width
        badge_right = right - 20
        badge_left = badge_right - badge_width
        badge_top = top + (height - 40) // 2
        badge_bottom = badge_top + 40
        draw.rounded_rectangle(
            (badge_left, badge_top, badge_right, badge_bottom),
            radius=10,
            fill=BADGE_BG,
            outline=BADGE_BORDER,
            width=1,
        )
        dot_x = badge_left + pad_x + dot_radius
        dot_y = (badge_top + badge_bottom) // 2
        draw.ellipse(
            (dot_x - dot_radius, dot_y - dot_radius, dot_x + dot_radius, dot_y + dot_radius),
            fill=dot_color,
        )
        draw.text((dot_x + dot_radius + gap, dot_y), badge_text, font=f["badge"], fill=TEXT, anchor="lm")

    panel(156, peak_badge, ORANGE)
    panel(264, off_badge, GREEN)

    draw.text((80, 390), caption, font=f["caption"], fill=CAPTION)
    draw.text((80, 426), note, font=f["note"], fill=MUTED)

    path = OUT / f"preview.{language}.png"
    image.save(path, optimize=True)
    print(f"Wrote {path}")


if __name__ == "__main__":
    render(
        "zh",
        "DSH峰谷提示插件",
        "会话标题栏效果示意 · 深色主题 · 非实际截图",
        "会话标题",
        "峰时 · 2倍",
        "谷时 · 1倍",
        "橙色：峰时（2 倍）    ·    绿色：谷时（1 倍基准）",
        "悬停查看倒计时与高峰时段；点击徽标打开官方价目表。",
    )
    render(
        "en",
        "DSH peak/off-peak badge",
        "Session header mockup · dark theme · not a screenshot",
        "Session title",
        "Peak · 2×",
        "Off-peak · 1×",
        "Orange: peak (2×)    ·    Green: off-peak (1× base)",
        "Hover for the countdown; click the badge to open the pricing page.",
    )
