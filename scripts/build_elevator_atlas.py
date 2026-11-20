"""Draw the elevator's three aligned PBR sheets. Used only when rebuilding the GLBs."""
import math
import random
from pathlib import Path

from build_gjh_marble import marble_tile

# x, y, width, height in the 512 px master; four equal indicator cells share a row.
REGIONS = {"sign": (0, 0, 512, 96), "edgeX": (256, 432, 64, 80),
           "edgeZ": (384, 96, 128, 64), "display": (0, 96, 96, 64),
           "wood": (0, 160, 128, 176), "stone": (128, 160, 224, 176),
           "steel": (352, 160, 80, 176), "mirror": (432, 160, 80, 176),
           "green": (0, 336, 64, 96), "brass": (64, 336, 64, 96),
           "lamp": (128, 336, 64, 96), "gold": (192, 336, 64, 96),
           "black": (256, 336, 64, 96), "glass": (320, 336, 128, 176),
           "leaf": (448, 336, 64, 176), "pot": (0, 432, 128, 80),
           "darkleaf": (128, 432, 64, 80), "soil": (192, 432, 64, 80)}

def draw_sheets(out):
    from PIL import Image, ImageDraw, ImageFont
    rng = random.Random(41)
    base = Image.new("RGBA", (512, 512), (20, 37, 31, 255))
    light = Image.new("RGB", base.size)
    orm = Image.new("RGB", base.size, (255, 130, 0))
    finishes = {
        "green": ((32, 64, 48), 80, 36), "brass": ((187, 139, 81), 83, 178),
        "lamp": ((255, 226, 164), 75, 9), "gold": ((255, 202, 113), 68, 90),
        "black": ((30, 33, 31), 98, 80), "wood": ((128, 84, 48), 126, 2),
        "mirror": ((131, 139, 124), 69, 150), "glass": ((149, 175, 164), 43, 54),
        "leaf": ((78, 117, 47), 132, 0), "darkleaf": ((48, 91, 49), 144, 0),
        "steel": ((177, 176, 164), 90, 178), "stone": ((233, 220, 192), 76, 26),
        "pot": ((197, 184, 159), 106, 32), "soil": ((54, 43, 33), 220, 0)
    }
    for name, (color, rough, metal) in finishes.items():
        x, y, w, h = REGIONS[name]
        ImageDraw.Draw(orm).rectangle((x,y,x+w-1,y+h-1), fill=(255,rough,metal))
        for j in range(h):
            brush = rng.uniform(-4, 4)
            for i in range(w):
                u, v = i/(w-1), j/(h-1)
                g = rng.uniform(-2, 2)
                alpha = 255
                if name == "wood":
                    g += 11*math.sin(38*u+1.5*math.sin(4*v))+6*math.cos(115*u+3*v)+3*math.sin(199*u)
                elif name in ("steel", "mirror", "brass", "pot"):
                    g += 14*math.cos(6*u) + 9*math.sin(8*u+3*v) + brush
                elif name == "glass":
                    streak = math.exp(-62*(u-.75*v-.16)**2)
                    alpha = int(12+18*streak+6*v)
                    g += 28*streak
                elif name.endswith("leaf"):
                    g += 14*(1-v)+10*math.sin(2.7*u)+18*math.exp(-140*(u-.5)**2)
                elif name == "green":
                    g += 4*math.cos(4*u+2*v)
                base.putpixel((x+i,y+j), tuple(max(0,min(255,round(c+g))) for c in color)+(alpha,))
        if name in ("gold", "lamp"):
            ImageDraw.Draw(light).rectangle((x,y,x+w-1,y+h-1),fill=(255,182,81) if name=="gold" else (255,216,146))
    x, y, w, h = REGIONS["stone"]
    base.paste(marble_tile().resize((w,h), Image.Resampling.LANCZOS), (x,y))
    # Pre-bake a small warm spill into the marble borders and fluted timber.
    # It remains legible at phone resolution without adding bloom or a light.
    for tile in ("edgeX","edgeZ"):
        x,y,w,h = REGIONS[tile]
        for j in range(h):
            for i in range(w):
                t=abs(2*(i/(w-1) if tile=="edgeX" else j/(h-1))-1)
                glow=math.exp(-3.4*t)
                base.putpixel((x+i,y+j),(int(51+181*glow),int(46+118*glow),int(38+29*glow),255))
                light.putpixel((x+i,y+j),(int(244*glow),int(151*glow),int(54*glow)))
    x,y,w,h=REGIONS["wood"]
    for j in range(h):
        v=j/(h-1)
        glow=math.exp(-54*(v-.38)**2)+.42*math.exp(-110*(v-.96)**2)
        for i in range(w):
            light.putpixel((x+i,y+j),(int(65*glow),int(38*glow),int(12*glow)))
    ink = (255,229,175)
    # The badge and floor graphics use Pillow's bundled Aileron font.
    def glyphs(draw, emission=False):
        text = ink if not emission else (245,192,112)
        if not emission:
            draw.rectangle((0,0,511,95), fill=(23,51,39))
            draw.line((6,6,505,6), fill=(103,88,60), width=2)
            draw.line((6,90,505,90), fill=(103,88,60), width=2)
        font = ImageFont.load_default(size=65)
        draw.text((204,46), "Elevator", fill=text, font=font, anchor="lm", stroke_width=1)
        draw.rounded_rectangle((100,28,156,75), radius=6,outline=text,width=3)
        for x in (118,139):
            draw.ellipse((x-4,36,x+4,44),fill=text)
            draw.line((x,47,x,64),fill=text,width=5)
            draw.line((x-5,48,x+5,48),fill=text,width=3)
        for x,sgn in ((117,-1),(140,1)):
            draw.line((x,10,x,22),fill=text,width=3)
            h=10 if sgn==-1 else 22
            draw.line((x-5,h-5*sgn,x,h,x+5,h-5*sgn),fill=text,width=2)
        for slot in range(4):
            x = slot*96
            if not emission:
                draw.rectangle((x,96,x+95,159),fill=(13,24,22))
            draw.text((x+30,127), "G" if slot<2 else "1", font=ImageFont.load_default(size=46),
                      fill=text,anchor="mm",stroke_width=1)
            cy=124 if slot%2==0 else 134
            dy=8 if slot%2==0 else -8
            draw.line((x+57,cy+dy,x+68,cy-2,x+79,cy+dy),fill=text,width=4)
    glyphs(ImageDraw.Draw(base))
    glyphs(ImageDraw.Draw(light), True)
    for image, name in ((base,"base"),(light,"emission"),(orm,"surface")):
        image.save(out / (name+".png"))

if __name__ == "__main__":
    import sys
    path = Path(sys.argv[1])
    path.mkdir(parents=True, exist_ok=True)
    draw_sheets(path)
