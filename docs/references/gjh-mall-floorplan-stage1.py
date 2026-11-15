"""Render the reviewed conceptual floor plan from its shared spatial data (Pillow)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / 'gjh-mall-spatial-plan.json').read_text())
OUT = HERE / 'gjh-mall-floorplan-stage1.png'
image = Image.new('RGB', (2700, 2240), '#f7f5ef')
draw = ImageDraw.Draw(image)
regular_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def font(size, bold=False):
    return ImageFont.truetype(bold_path if bold else regular_path, size)
ink, muted, green, gold = '#17372e', '#52685f', '#315b49', '#a88542'
white = '#fffdf8'
left, top, scale = 180, 350, 27

def pt(x, y):
    return (round(left + x * scale), round(top + (60-y) * scale))

def box(bounds, fill, outline=green, width=3):
    x0,y0,x1,y1 = bounds
    draw.rectangle((pt(x0,y1),pt(x1,y0)),fill=fill,outline=outline,width=width)

def text_center(text, x, y, size=26, fill=ink, bold=False, spacing=6):
    draw.multiline_text(pt(x,y), text, font=font(size,bold), fill=fill, anchor='mm', align='center', spacing=spacing)

def line(points, fill=green, width=3):
    draw.line([pt(*p) for p in points], fill=fill, width=width, joint='curve')

def dashed(points, color=gold, width=7):
    import math
    for a,b in zip(points,points[1:]):
        a,b=pt(*a),pt(*b);length=math.dist(a,b)
        for i in range(0,int(length),27):
            end=min(i+15,length)
            draw.line((a[0]+(b[0]-a[0])*i/length,a[1]+(b[1]-a[1])*i/length,
                       a[0]+(b[0]-a[0])*end/length,a[1]+(b[1]-a[1])*end/length),fill=color,width=width)

def doorway(coords, color=gold):
    x0,y0,x1,y1=coords
    line([(x0,y0),(x1,y1)],white,12)
    line([(x0,y0),(x1,y1)],color,6)

# Equal x/y scale in both diagrams; all spatial elements come from JSON.
draw.text((95,52),'GJH VIRTUAL MALL  /  STAGE 1',font=font(34,True),fill=green)
draw.text((95,103),'17-store spatial plan',font=font(68,True),fill=ink)
draw.text((98,192),'PROPOSED CONCEPT  •  70 × 60 m  •  17 INDEPENDENT SLOTS',font=font(29),fill=muted)
box(DATA['shell'],white,ink,5)
for name in ['west','east','north','south']:
    box(DATA['ring'][name], '#e9f0e8', '#e9f0e8', 1)
for store in DATA['stores']:
    color = '#f2e1c3' if store['id'] in [f'S{i:02}' for i in list(range(1,4))+list(range(6,12))] else '#e1ede7' if store['id'] in ['S04','S05','S12'] else '#dfeaf0'
    box(store['bounds'],color)
for reserve in DATA['reserves']:
    box(reserve['bounds'],'#e3e8df')
for zone in DATA['zones']:
    box(zone['bounds'],zone['color'],'#95a99a',3)
box(DATA['lift']['shaft'],'#bcd5ca',green,3)
for store in DATA['stores']:
    x0,y0,x1,y1=store['bounds'];cx=(x0+x1)/2;cy=(y0+y1)/2
    name=store['candidate'].replace('Pien Tze Huang','Pien Tze\nHuang').replace('California Mexico','California\nMexico').replace('Flying Wheel','Flying\nWheel')
    text_center(store['id'],cx,cy+2.4,22,muted,True)
    text_center(name,cx,cy,26,ink,True,spacing=3)
    text_center('10 × 12 m' if store['side']=='north' else '10 × 8 m',cx,cy-2.5,20,muted)
    doorway(store['door'])
for reserve in DATA['reserves']:
    x0,y0,x1,y1=reserve['bounds'];cx=(x0+x1)/2
    text_center(reserve['id'],cx,55.5,23,muted,True)
    text_center('SERVICE\nRESERVE',cx,52.5,23,ink,True)
    doorway(reserve['externalDoor'],'#718378')

dashed(DATA['ring']['centerline'])
dashed([(35,0),(35,9)])
text_center('6 m',13,29,25,green,True)
text_center('6 m',57,29,25,green,True)
text_center('LIFT\nSHAFT',22,38,19,ink,True,3)
text_center('LOBBY',18,35.2,18,ink,True)
text_center('FACILITIES',50,38,22,ink,True)
text_center('LOUNGE',21,24,20,ink,True)
text_center('LOUNGE',49,24,20,ink,True)
text_center('LOW PLANTING',35,32,21,ink,True)
text_center('SEASONAL / EVENT',35,20.7,24,ink,True)
text_center('14 × 8 m',35,18.3,20,muted)
text_center('MAP',20,3,20,ink,True)
text_center('GUEST',50,3,20,ink,True)
text_center('CLEAR ARRIVAL',35,4,21,muted,True)
doorway(DATA['lift']['door'])
doorway(next(z['door'] for z in DATA['zones'] if z['id']=='WC'))
doorway(DATA['entry']['opening'])
text_center('MAIN ENTRY 12 m',35,-2.4,25,ink,True)

# Dimension witnesses are outside the floor footprint.
line([(0,60),(0,64)],muted,2);line([(70,60),(70,64)],muted,2)
line([(0,63),(70,63)],muted,3)
for x in [0,70]:line([(x-.5,62.4),(x+.5,63.6)],muted,3)
text_center('70 m',35,64.6,28,ink,True)
line([(0,0),(-3.5,0)],muted,2);line([(0,60),(-3.5,60)],muted,2)
line([(-3,0),(-3,60)],muted,3)
for y in [0,60]:line([(-3.5,y-.5),(-2.5,y+.5)],muted,3)
draw.text((47,1090),'60 m',font=font(27,True),fill=ink)

# Upper inset: same plan axes, no claim of a second retail level.
x,y=2140,400;unit=29
floor=DATA['lift']['upperPlatform'];shaft=DATA['lift']['shaft'];lobby=DATA['lift']['upperLobby']
def upxy(px,py):return (round(x+(px-floor[0])*unit),round(y+(floor[3]-py)*unit))
def upbox(r,fill):
    x0,y0,x1,y1=r;draw.rectangle((upxy(x0,y1),upxy(x1,y0)),fill=fill,outline=green,width=3)
draw.text((2125,290),'UPPER LEVEL',font=font(30,True),fill=ink)
draw.text((2125,335),'12 × 12 m • +7.2 m',font=font(24),fill=muted)
upbox(floor,'#eef2e9');upbox(lobby,'#dbe9df');upbox(shaft,'#bcd5ca')
draw.text(upxy(17.8,38),'LOBBY',font=font(18,True),anchor='mm',fill=ink)
draw.multiline_text(upxy(22,38),'LIFT\nSHAFT',font=font(19,True),anchor='mm',align='center',fill=ink,spacing=3)
draw.line((upxy(20,37),upxy(20,39)),fill=gold,width=6)
draw.text((2125,790),'Same shaft and opening on',font=font(23),fill=muted)
draw.text((2125,822),'both floors. No upper shops.',font=font(23),fill=muted)
draw.text((2125,854),'Inset slightly enlarged.',font=font(22),fill=muted)

notes=[('CIRCULATION','6 m continuous loop; centerline shown'),('STOREFRONT OPENINGS','North 5 m  /  side stores 4 m'),('ACCESS','Main entrance 12 m; visitor lift'),('SERVICE RESERVES','North boundary access, not public'),('ARRANGEMENT','Planting, seating, seasonal display'),('FUTURE THEMES','Keep all props out of the 6 m loop')]
for i,(title,body) in enumerate(notes):
    yy=930+i*142
    draw.text((2125,yy),title,font=font(23,True),fill=green)
    # split manually at available inset width
    import textwrap
    draw.multiline_text((2125,yy+35),'\n'.join(textwrap.wrap(body,width=29)),font=font(22),fill=muted,spacing=6)

footer=2070
draw.text((95,footer),'S01–S17 = proposed independent slots    •    gold = openings and route centerline    •    R1/R2 = service reserves',font=font(26,True),fill=ink)
draw.text((95,footer+48),'Concept dimensions only. Brand relationships, physical building access, accessibility and safety compliance are not certified.',font=font(24),fill=muted)
draw.text((95,footer+90),'Exact coordinates, clearance assumptions, lift/cart limits and implementation checks: docs/gjh-v11-stage1-spatial-plan.md',font=font(23),fill=muted)
image.save(OUT,optimize=True)
print(OUT)
