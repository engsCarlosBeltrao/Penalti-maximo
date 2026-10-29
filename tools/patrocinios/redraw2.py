from lib import *
from fix_bmg import ink_box
def leap(col,tw=240):
    f=FI+'Inter-SemiBold.otf'; size=32
    c=Canvas(400,60)
    # icon (psi-like emblem)
    ix,iy=4,4; h=27
    c.poly([(ix,iy),(ix+5.5,iy),(ix+16.5,iy+h-6),(ix+14,iy+h),(ix+11,iy+h)],col)               # left blade
    c.poly([(ix+34,iy),(ix+28.5,iy),(ix+17.5,iy+h-6),(ix+20,iy+h),(ix+23,iy+h)],col)           # right blade
    c.rrect((ix+14.2,iy-2,ix+19.8,iy+h+1),2.5,fill=col)                                          # centre bar
    txt='LEAPMOTOR'
    # fit tracking
    sp=0; w=c.width(txt,f,size,sp); sp=(tw-w)/(len(txt)-1)
    c.text((ix+34+12,iy+h-1.5),txt,f,size,col,spacing=sp)
    return c.finish()
for k,col in [('palmeiras_home',(238,247,241)),('palmeiras_away',(16,82,50)),('palmeiras_third',(240,192,112))]:
    a=load(k); t=leap(col)
    erase(a,(610,925,0,18)); paste(a,t,768-t.shape[1]/2,13); save(k,a); print(k,t.shape)
