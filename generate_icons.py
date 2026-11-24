import os
from PIL import Image, ImageDraw

os.makedirs('icons', exist_ok=True)

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = max(1, size // 16)
    radius = max(2, size // 4)
    
    # Sober, professional graphite/slate color (#1e293b / #262e3d)
    bg_color = (30, 41, 59, 255)
    
    draw.rounded_rectangle(
        [margin, margin, size - margin - 1, size - margin - 1],
        radius=radius,
        fill=bg_color
    )
    
    # Clean white emblem
    if size == 16:
        draw.ellipse([4, 4, 9, 9], outline=(255, 255, 255, 255), width=1)
        draw.line([9, 7, 12, 10], fill=(255, 255, 255, 255), width=1)
        draw.line([11, 9, 12, 8], fill=(255, 255, 255, 255), width=1)
    elif size == 48:
        draw.ellipse([10, 10, 26, 26], fill=None, outline=(255, 255, 255, 255), width=3)
        draw.ellipse([15, 15, 21, 21], fill=(255, 255, 255, 255))
        draw.line([(24, 24), (37, 37)], fill=(255, 255, 255, 255), width=4)
        draw.line([(31, 31), (34, 28)], fill=(255, 255, 255, 255), width=3)
        draw.line([(35, 35), (38, 32)], fill=(255, 255, 255, 255), width=3)
    else: # 128
        draw.ellipse([26, 26, 70, 70], outline=(255, 255, 255, 255), width=9)
        draw.ellipse([39, 39, 57, 57], fill=(255, 255, 255, 255))
        draw.line([(64, 64), (102, 102)], fill=(255, 255, 255, 255), width=10)
        draw.line([(82, 82), (92, 72)], fill=(255, 255, 255, 255), width=8)
        draw.line([(94, 94), (104, 84)], fill=(255, 255, 255, 255), width=8)
        
    img.save(f'icons/icon-{size}.png', 'PNG')
    print(f'Generated icons/icon-{size}.png ({size}x{size})')

for s in [16, 48, 128]:
    create_icon(s)
