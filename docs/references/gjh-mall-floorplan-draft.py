"""Draw the proposed, dimensioned V11 mall layout; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).with_name('gjh-mall-floorplan-draft.png')
W, H = 2200, 2160
image = Image.new('RGB', (W, H), '#f6f4ed')
draw = ImageDraw.Draw(image)
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
regular = lambda size: ImageFont.truetype(font_path, size)
bold = lambda size: ImageFont.truetype(bold_path, size)

ink = '#183a31'
muted = '#51685e'
gold = '#b18d4d'
food = '#f1e2c3'
health = '#dcebe3'
tech = '#dce6ec'
public = '#e9eee6'
outline = '#36554a'

draw.text((110, 55), 'GJH VIRTUAL MALL', font=bold(44), fill=ink)
draw.text((110, 115), 'Proposed expanded floor plan', font=bold(65), fill=ink)
draw.text((110, 200), 'CONCEPT / NOT BUILT  •  illustrative footprint: 70 m × 60 m  •  17 candidate stores', font=regular(31), fill=muted)

# All world coordinates below are metres. The south/front edge is y=0.
scale = 22
left, top = 245, 420
def pt(x, y):
    return (round(left + x * scale), round(top + (60 - y) * scale))
def rect(x0, y0, x1, y1, fill, stroke=outline, width=3):
    a, b = pt(x0, y1), pt(x1, y0)
    draw.rectangle((a, b), fill=fill, outline=stroke, width=width)
def centered(text, x, y, font, fill=ink, spacing=5):
    draw.multiline_text(pt(x, y), text, font=font, fill=fill, anchor='mm', align='center', spacing=spacing)
def line(points, fill=outline, width=3):
    draw.line([pt(x,y) for x,y in points], fill=fill, width=width)
def dash(points, fill='#ad955d', width=5, length=14, gap=10):
    import math
    for (x0,y0),(x1,y1) in zip(points,points[1:]):
        a,b=pt(x0,y0),pt(x1,y1)
        d=math.dist(a,b)
        if not d: continue
        pos=0
        while pos<d:
            end=min(d,pos+length)
            draw.line((a[0]+(b[0]-a[0])*pos/d,a[1]+(b[1]-a[1])*pos/d,a[0]+(b[0]-a[0])*end/d,a[1]+(b[1]-a[1])*end/d),fill=fill,width=width)
            pos+=length+gap

rect(0,0,70,60,'#fffdf7',ink,5)
rect(10,0,60,48,'#f6f2e8',outline,2)

north = [('01','New Moon',food),('02','MILI',food),('03','GOGO',food),('04','Borsch Med',health),('05','Pien Tze\nHuang',health)]
west = [('06','Flying Wheel',food),('07','Gu Long',food),('08','Skippy',food),('09','SPAM',food),('10','California\nMexico',food),('11','Hormel',food)]
east = [('12','Zeria',health),('13','Sony',tech),('14','LG',tech),('15','Casio',tech),('16','GP',tech),('17','Gigaset',tech)]
for i,(number,name,color) in enumerate(north):
    x=10+i*10
    rect(x,48,x+10,60,color)
    centered(number, x+5,57, bold(25), muted)
    centered(name, x+5,53.5, bold(23))
    centered('10 × 12 m',x+5,50.4,regular(19),muted)
for rows,x0 in ((west,0),(east,60)):
    for i,(number,name,color) in enumerate(rows):
        y=48-(i+1)*8
        rect(x0,y,x0+10,y+8,color)
        centered(number,x0+5,y+6.7,bold(23),muted)
        centered(name,x0+5,y+4.2,bold(22))
        centered('10 × 8 m',x0+5,y+1.1,regular(18),muted)
rect(0,48,10,60,public)
centered('RESERVE',5,55.5,bold(25))
centered('future\nsupport',5,52,regular(21),muted)
rect(60,48,70,60,public)
centered('RESERVE',65,55.5,bold(25))
centered('future\nsupport',65,52,regular(21),muted)

rect(12,38,20,46,public)
centered('LIFT',16,43,bold(24))
centered('upper level',16,40.5,regular(19),muted)
rect(50,38,58,46,public)
centered('FACILITIES',54,43,bold(20))
centered('restrooms',54,40.5,regular(19),muted)

rect(28,28,42,33,'#d1e1cb','#68826d')
centered('LOW PLANTING',35,30.5,bold(22))
rect(25,13,45,22,'#f2e8d1','#c8af78')
centered('FLEXIBLE EVENT AREA',35,19,bold(22))
centered('seasonal displays',35,16,regular(20),muted)
rect(13,23,23,31,'#e5e8dc','#a9b8a5')
centered('LOUNGE',18,27,bold(22))
rect(47,23,57,31,'#e5e8dc','#a9b8a5')
centered('LOUNGE',52,27,bold(22))
rect(13,4,23,10,'#ebe9dc','#b2b5a4')
centered('DIRECTORY',18,7,bold(20))
rect(47,4,57,10,'#ebe9dc','#b2b5a4')
centered('GUEST SERVICE',52,7,bold(20))

dash([(32,0),(32,9),(24,11),(24,34),(35,38),(48,38)])
dash([(38,0),(38,9),(46,11),(46,34),(35,38),(22,38)])
centered('OPEN ATRIUM / CIRCULATION',35,42,bold(24),muted)

# Mark the entrance opening along the south edge without implying detailed doors.
draw.line((pt(29,0),pt(41,0)),fill='#fffdf7',width=11)
draw.line((pt(29,0),pt(29,1)),fill=ink,width=5)
draw.line((pt(41,0),pt(41,1)),fill=ink,width=5)
centered('MAIN ENTRY  •  proposed 12 m opening',35,-3.5,bold(25))
line([(35,-1.4),(35,3)],gold,5)
line([(34.4,2.2),(35,3),(35.6,2.2)],gold,5)

# Dimension lines; the equal x/y scale applies only to the proposed shell and blocks.
line([(0,60),(0,64.0)],muted,2)
line([(70,60),(70,64.0)],muted,2)
line([(0,63),(70,63)],muted,3)
for x in (0,70): line([(x-.6,62.3),(x+.6,63.7)],muted,3)
centered('70 m',35,64.8,bold(27))
line([(0,0),(-5,0)],muted,2)
line([(0,60),(-5,60)],muted,2)
line([(-4,0),(-4,60)],muted,3)
for y in (0,60): line([(-4.6,y-.6),(-3.4,y+.6)],muted,3)
draw.text((45, 1030), '60 m', font=bold(27), fill=ink)

legend_y=1900
draw.text((110,legend_y),'ZONE KEY',font=bold(27),fill=ink)
for x,color,label in ((350,food,'Food & beverage'),(790,health,'Health & wellness'),(1250,tech,'Lifestyle / electronics'),(1740,public,'Facilities')):
    draw.rectangle((x,legend_y+1,x+27,legend_y+28),fill=color,outline=outline,width=2)
    draw.text((x+40,legend_y-1),label,font=regular(25),fill=ink)
draw.text((110,1960),'Store names are candidates based on GJH sources, not confirmed stores or ownership. Dimensions are design assumptions.',font=regular(27),fill=muted)
draw.text((110,2003),'Concept only: routes, lift, facilities, safety and compliance require detailed design and validation.',font=regular(27),fill=muted)
draw.text((110,2046),'Draft • 15 Nov 2026   |   See the accompanying layout brief for source links and area calculations.',font=regular(25),fill=muted)
image.save(OUT, optimize=True)
print(OUT)
