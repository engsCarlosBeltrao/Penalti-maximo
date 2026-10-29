from lib import *
def vilma(kind,W=158,H=74):
    BL=(24,84,190); WH=(255,255,255)
    c=Canvas(W+8,H+8); o=4
    f=FI+'Inter-ExtraBoldItalic.otf'
    if kind=='third':
        c.rrect((o,o,o+W,o+H),17,fill=(13,98,208))
        c.rrect((o+5,o+5,o+W-5,o+H-5),13,outline=WH,width=2)
        tw=c.width('Vilma',f,46,-2); c.text((o+W/2-tw/2,o+50),'Vilma',f,46,WH,spacing=-2)
        f2=FI+'Inter-Bold.otf'; w2=c.width('ALIMENTOS',f2,9,3.2); c.text((o+W/2-w2/2,o+H-12),'ALIMENTOS',f2,9,WH,spacing=3.2)
    else:
        c.rrect((o,o,o+W,o+H),17,fill=WH)
        c.rrect((o+5,o+5,o+W-5,o+H-5),13,outline=BL,width=2)
        tw=c.width('Vilma',f,52,-2); c.text((o+W/2-tw/2,o+H/2+19),'Vilma',f,52,BL,spacing=-2)
    return c.finish(crop=False)
for k,kind in [('cruzeiro_home','home'),('cruzeiro_away','away'),('cruzeiro_third','third')]:
    a=load(k); t=vilma(kind)
    bgc=np.median(a[30:34,640:670].reshape(-1,3),0)
    a=inpaint_ink(a,(660,880,0,52),'dist',(28,80),grow=3,bg=bgc)
    t=resize(t,s=0.97); paste(a,t,768-t.shape[1]/2,0); save(k,a); print(k,t.shape)
