from lib import *
def pinheiro(col,inner,H=1.0):
    c=Canvas(300,80); f=FI+'Inter-ExtraBoldItalic.otf'; f2=FI+'Inter-BoldItalic.otf'
    cx,cy,r=30,34,26
    c.ell((cx-r,cy-r,cx+r,cy+r),fill=col)
    # pine tree (white) in circle
    tri=lambda y0,y1,hw:[(cx,y0),(cx+hw,y1),(cx-hw,y1)]
    c.poly(tri(cy-18,cy-4,9),inner); c.poly(tri(cy-12,cy+5,12),inner); c.poly(tri(cy-5,cy+14,15),inner)
    c.poly([(cx-2.5,cy+14),(cx+2.5,cy+14),(cx+2.5,cy+20),(cx-2.5,cy+20)],inner)
    c.text((62,50),'Pinheiro',f,46,col,spacing=-1.5)
    c.text((82,70),'O bom vizinho',f2,15,col,spacing=0.3)
    return c.finish()
# away
a=load('fortaleza_away'); t=pinheiro((214,170,72),(240,238,230)); t=resize(t,215)
erase(a,(640,885,0,42)); paste(a,t,(660+820)/2-t.shape[1]/2+12,8); save('fortaleza_away',a); print(t.shape)
# home: clean remnant on the blue band, logo (white) on the red body below the white line
a=load('fortaleza_home')
for y in range(0,24):
    l=a[y,622:632].mean(0); r=a[y,908:918].mean(0)
    w=np.linspace(0,1,908-632)[:,None]
    a[y,632:908]=l*(1-w)+r*w
t=pinheiro((246,244,240),(176,28,52)); t=resize(t,200)
paste(a,t,768-t.shape[1]/2,28); save('fortaleza_home',a)
# bahia remnants (tiny text on top edge)
for k in ['bahia_home','bahia_away']:
    a=load(k)
    c=a[0:8,700:840]; 
    a=inpaint_ink(a,(700,840,0,8),'dist',(30,90),grow=3)
    save(k,a)
