"""Check the stage 1 conceptual plan geometry; this does not simulate the mall."""
import json
import math
from pathlib import Path

plan = json.loads(Path(__file__).with_name('gjh-mall-spatial-plan.json').read_text())
stores, zones, reserves = plan['stores'], plan['zones'], plan['reserves']

def area(r):
    x0,y0,x1,y1 = r
    assert x0 < x1 and y0 < y1, r
    return (x1-x0)*(y1-y0)

def overlap(a,b):
    return max(0,min(a[2],b[2])-max(a[0],b[0])) * max(0,min(a[3],b[3])-max(a[1],b[1]))

def inside(a,b):
    return b[0] <= a[0] <= a[2] <= b[2] and b[1] <= a[1] <= a[3] <= b[3]

def distance(p,r):
    x,y=p
    return math.hypot(max(r[0]-x,0,x-r[2]),max(r[1]-y,0,y-r[3]))

def samples(a,b):
    length=math.dist(a,b)
    for i in range(max(1,math.ceil(length/.1))+1):
        t=i/max(1,math.ceil(length/.1))
        yield (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)

def assert_clear_path(points, radius, obstacles):
    for a,b in zip(points,points[1:]):
        for p in samples(a,b):
            for name,r in obstacles:
                assert distance(p,r) >= radius - 1e-8, (name,p,radius)

assert len(stores)==17 and len({s['id'] for s in stores})==17
assert [s['candidate'] for s in stores[:3]] == ['New Moon','MILI','GOGO']
assert all(inside(x['bounds'], plan['shell']) for x in stores+reserves+zones)
all_blocks=stores+reserves
for i,a in enumerate(all_blocks):
    for b in all_blocks[i+1:]:assert overlap(a['bounds'],b['bounds'])==0,(a['id'],b['id'])
assert sum(area(s['bounds']) for s in stores)==1560
assert sum(area(s['bounds']) for s in reserves)==240
assert area(plan['shell'])==4200
assert 4200-1560-240==area([10,0,60,48])==2400
for i,a in enumerate(zones):
    for b in zones[i+1:]:assert overlap(a['bounds'],b['bounds'])==0,(a['id'],b['id'])
    for ring in ('west','east','north','south'):assert overlap(a['bounds'],plan['ring'][ring])==0,(a['id'],ring)
    for store in stores:assert overlap(a['bounds'],store['bounds'])==0,(a['id'],store['id'])
    assert overlap(a['bounds'],plan['entry']['approach'])==0,a['id']
assert all(area(z['bounds'])==64 for z in zones if z['id'] in ['LIFT','WC'])
ring=plan['ring'];assert ring['width']==6
assert ring['west']==[10,6,16,48] and ring['east']==[54,6,60,48]
assert ring['north']==[10,42,60,48] and ring['south']==[10,6,60,12]
# The ring is the 50x42 outer rectangle minus its 38x30 inner opening.
assert 50*42-38*30==960
obstacles=[(z['id'],z['bounds']) for z in zones]
planning_radius=plan['planningEnvelopes']['cartColliderRadius']+plan['planningEnvelopes']['extraMargin']
assert planning_radius==1.65
assert_clear_path(ring['centerline'],planning_radius,obstacles)
assert_clear_path([[35,3],[35,9]],planning_radius,obstacles)
# Approach routes stay clear of all reserved zones; threshold checks use the
# specified straight portal, with no future furniture or wall thickness modelled.
for store in stores:
    side=store['side'];x,y=store['arrival'];door=store['door']
    if side=='north':
        assert door[1]==door[3]==48 and door[2]-door[0]==5
        assert store['bounds'][0]<=door[0]<door[2]<=store['bounds'][2]
        assert door[0]<x<door[2] and abs(y-48)>=planning_radius
        assert store['inside'][0]==x and store['inside'][1]>=48+planning_radius
        route=[[x,45],[x,y]];width=door[2]-door[0]
    else:
        assert door[0]==door[2]==(10 if side=='west' else 60) and door[3]-door[1]==4
        assert store['bounds'][1]<=door[1]<door[3]<=store['bounds'][3]
        assert door[1]<y<door[3] and abs(x-door[0])>=planning_radius
        assert store['inside'][1]==y and abs(store['inside'][0]-door[0])>=planning_radius
        aisle=13 if side=='west' else 57
        route=[[aisle,max(9,min(45,y))],[aisle,y],[x,y]];width=door[3]-door[1]
    assert width>=2*planning_radius
    assert_clear_path(route,planning_radius,obstacles)
    assert inside([*store['inside'],*store['inside']],store['bounds'])
    assert store['id'] in [f'S{i:02}' for i in range(1,18)]
# Conceptual foot-only lift: both floors share the shaft, 2 m opening and lobby.
lift=plan['lift'];shaft=lift['shaft'];cabin=lift['cabinEnvelope']
assert shaft==[20,36,24,40] and inside(cabin,shaft)
assert lift['door']==[20,37,20,39] and lift['groundLobby']==lift['upperLobby']
assert lift['cabinDoor']==[20.4,37,20.4,39] and lift['thresholdBridge']==[20,37,20.4,39]
assert inside(shaft,lift['upperPlatform']) and inside(lift['upperLobby'],lift['upperPlatform'])
assert area(lift['upperPlatform'])==144 and lift['upperHeight']==7.2
assert_clear_path([[13,38],[18,38]],.55,[(z['id'],z['bounds']) for z in zones if z['id']!='LIFT']+[('shaft',shaft)])
assert distance((18,38),shaft)>=.55
upper_path=[[18,38],[18,33],[26,33]]
assert_clear_path(upper_path,.55,[('shaft',shaft)])
for a,b in zip(upper_path,upper_path[1:]):
    for x,y in samples(a,b):
        assert 16+.55<=x<=28-.55 and 32+.55<=y<=44-.55
facility=next(z for z in zones if z['id']=='WC')
assert facility['door']==[54,36.5,54,39.5]
for reserve in reserves:
    d=reserve['externalDoor'];b=reserve['bounds']
    assert d[1]==d[3]==b[3]==60 and b[0]<=d[0]<d[2]<=b[2]
print('PASS: 17 non-overlapping store blocks, 4,200 m² shell and area allocation')
print('PASS: 6 m ring, 17 portal approaches and entry against reserved-area geometry')
print('PASS: nominal 1.4 m cart radius + 0.25 m margin at 4 m / 5 m portals')
print('PASS: matching ground/upper visitor lift shaft and reserve boundary openings')
print('LIMIT: 2D planning geometry only; no walls, furniture, physics, camera or regulatory compliance simulated')
