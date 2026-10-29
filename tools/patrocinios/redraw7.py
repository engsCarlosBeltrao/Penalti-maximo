from lib import *
from fix2 import ink_box
import fix_bmg
from redraw3 import feather_mask
def mk_ademicon():
    t=extract(load('coritiba_home'),(600,940,0,75),'lo',(90,170)); return t
TA=mk_ademicon(); print('ademicon tpl',TA.shape)
def ademicon(k,col,kind,p,W=238,top=9,cx=768):
    a=load(k)
    if k=='athletico-pr_home':
        x0,x1,y0,y1=650,905,0,66; dx,dy=-96,60
        src=a[y0+dy:y1+dy,x0+dx:x1+dx].copy(); m=feather_mask(y1-y0,x1-x0,6)
        a[y0:y1,x0:x1]=a[y0:y1,x0:x1]*(1-m)+src*m
        a=inpaint_ink(a,(630,656,0,66),'hi',(185,225),grow=3)
    else: a=inpaint_ink(a,(630,915,0,62),kind,p,grow=4)
    t=resize(tint(TA,col),W); paste(a,t,cx-t.shape[1]/2,top); save(k,a); print(k,t.shape)
ademicon('athletico-pr_home',(250,250,250),'hi',(190,235))
ademicon('athletico-pr_away',(24,24,26),'lo',(80,160))
ademicon('athletico-pr_third',(226,30,38),'rb',(60,120))
# atletico-mg third: replace bmg
Tbmg=extract(load('vasco_third'),(600,940,0,90),'dist',(25,90))
a=load('atletico-mg_third'); ib=ink_box(a,(600,940,0,120),'lo',(50,110)); print('amg third',ib)
a=inpaint_ink(a,(600,940,0,min(ib[3]+4,125)),'lo',(50,110),grow=4)
t=resize(tint(Tbmg,(25,25,25)),185); paste(a,t,768-t.shape[1]/2+ (1180/1.5*0+0),10); save('atletico-mg_third',a)
# flamengo third lubrax
Tl=extract(load('flamengo_home'),(600,940,0,60),'hi',(110,190))
a=load('flamengo_third'); a=inpaint_ink(a,(610,910,0,48),'hi',(200,235),grow=4)
t=resize(tint(Tl,(250,250,250)),235); paste(a,t,(627+891)/2-t.shape[1]/2,10); save('flamengo_third',a)
# gremio home banrisul (gold)
Tb=clean_template(extract(load('gremio_third'),(600,940,22,90),'hi',(95,140)),drop_top_frac=0.2,min_area=90)
a=load('gremio_home'); erase(a,(610,930,0,52),feather=4)
t=resize(tint(Tb,(222,170,36)),215); paste(a,t,768-t.shape[1]/2,10); save('gremio_home',a)
# ceara home: diadora
a=load('ceara_home'); a=inpaint_ink(a,(722,812,0,24),'hi',(90,150),grow=3)
c=Canvas(120,40); w=c.width('diadora',FI+'Inter-Bold.otf',19,0.4); c.text((4,28),'diadora',FI+'Inter-Bold.otf',19,(214,214,214),spacing=0.4)
t=c.finish(); paste(a,t,768-t.shape[1]/2-3,6); save('ceara_home',a); print('diadora',t.shape)
# sao paulo remnants
for k in ['saopaulo_away','saopaulo_home']:
    a=load(k); y=8
    a[0:y,640:930]=a[y:y+1,640:930]; save(k,a)
# vitoria: drop icon, move wordmark up
for k in ['vitoria_home','vitoria_away','vitoria_third']:
    a=load(k)
    blk=a[31:57,600:940].copy()
    fillrow=np.median(a[64:68,600:940],0)
    reg=a[0:57,600:940].copy(); new=reg.copy(); new[:]=fillrow[None]
    fm=feather_mask(57,340,6); a[0:57,600:940]=reg*(1-fm)+new*fm
    bm=feather_mask(26,340,6); d=a[10:36,600:940]; a[10:36,600:940]=d*(1-bm)+blk*bm
    save(k,a)
