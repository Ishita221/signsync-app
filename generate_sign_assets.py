from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).parent / "static" / "signs"
OUT.mkdir(parents=True, exist_ok=True)


def _font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def make_card(label: str, big: str, filename: str):
    w, h = 360, 360
    img = Image.new("RGB", (w, h), (12, 14, 20))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle((18, 18, w - 18, h - 18), radius=28, fill=(18, 25, 40))
    d.text((32, 28), "SignSync", fill=(160, 160, 160), font=_font(22))

    f_big = _font(170)
    bbox = d.textbbox((0, 0), big, font=f_big)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((w - tw) / 2, (h - th) / 2 - 10), big, fill=(80, 220, 180), font=f_big)

    f_small = _font(26)
    bbox2 = d.textbbox((0, 0), label, font=f_small)
    tw2 = bbox2[2] - bbox2[0]
    d.text(((w - tw2) / 2, h - 70), label, fill=(210, 210, 210), font=f_small)

    img.save(OUT / filename)


def main():
    # Special cards
    make_card("SPACE", "␣", "SPACE.png")
    make_card("UNKNOWN", "?", "UNKNOWN.png")

    # A-Z
    for code in range(ord("A"), ord("Z") + 1):
        ch = chr(code)
        make_card(ch, ch, f"{ch}.png")

    # 0-9
    for ch in "0123456789":
        make_card(ch, ch, f"{ch}.png")

    print(f"Generated sign cards in: {OUT}")


if __name__ == "__main__":
    main()

