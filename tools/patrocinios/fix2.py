from lib import *
from fix_bmg import ink_box
def sample(a,region,kind,p):
    r=extract(a,region,kind,p); m=r[...,3]>235
    return np.median(r[...,:3][m],0)
def place(k,T,col,W,region,kind,p,top=10,cx=None,em=8,de=6,mode='mirror',ink=None,a=None,save_=True):
    a=load(k) if a is None else a
    ib=ink_box(a,region,kind,p)
    col=col if col is not None else sample(a,region,kind,p)
    if cx is None: cx=(ib[0]+ib[1])/2
    if mode=='mirror': erase(a,(ib[0]-em,ib[1]+em,0,ib[3]+de))
    else:
        ik=ink or (kind,p)
        a=inpaint_ink(a,region,ik[0],ik[1])
    t=resize(tint(T,col),W)
    paste(a,t,cx-t.shape[1]/2,top)
    if save_: save(k,a)
    print(k,ib,np.round(col,0)); return a
Tl=extract(load('flamengo_home'),(600,940,0,60),'hi',(110,190))
Ts=clean_template(extract(load('fluminense_home'),(625,905,0,38),'hi',(150,215)),open_k=5)
Tb=clean_template(extract(load('gremio_third'),(600,940,22,90),'hi',(95,140)),drop_top_frac=0.2,min_area=90)
if __name__=='__main__':
    place('flamengo_away',Tl,(24,24,26),235,(600,940,0,50),'lo',(80,170))
    place('fluminense_away',Ts,None,235,(600,940,0,36),'lo',(120,200))
    place('fluminense_third',Ts,None,235,(600,940,0,36),'hi',(60,110))
    place('gremio_away',Tb,(28,150,226),215,(600,940,0,58),'blue',(120,200),mode='inpaint')
    place('internacional_away',Tb,None,215,(600,940,0,30),'lo',(150,200),em=14)
    place('internacional_home',Tb,None,215,(600,940,0,30),'hi',(200,235),em=14)
