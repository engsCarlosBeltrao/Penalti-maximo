from lib import *
from fix_bmg import ink_box
from fix2 import sample
def finish_kit(k,a,t,cx,top,erase_box=None,mode='mirror'):
    if erase_box: erase(a,erase_box)
    paste(a,t,cx-t.shape[1]/2,top); save(k,a)

# ---------- betnacional ----------
def betnacional(col_bet,col_nac,H=44):
    c=Canvas(420,100)
    f1=FI+'Inter-ExtraBold.otf'; f2=FI+'Inter-Medium.otf'
    x=c.text((6,60),'bet',f1,H,col_bet,spacing=-1)
    x=c.text((x+2,60),'nacional',f2,H,col_nac,spacing=-0.5)
    # swoosh under 'b'
    c.poly([(7,68),(31,60),(34,67),(10,75)],col_bet)
    return c.finish()
for k,cb,cn in [('sport_home',(255,196,34),(255,196,34)),('sport_away',(24,24,24),(24,24,24)),('sport_third',(232,204,146),(232,204,146))]:
    a=load(k); ib=ink_box(a,(592,936,0,48),'dist',(40,110)); print(k,ib)
    t=betnacional(cb,cn); t=resize(t,250)
    erase(a,(ib[0]-6,ib[1]+6,0,ib[3]+8))
    paste(a,t,(ib[0]+ib[1])/2-t.shape[1]/2,10); save(k,a)
