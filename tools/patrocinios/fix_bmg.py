from lib import *
import sys
def ink_box(a,region,kind,p,bg=None):
    x0,x1,y0,y1=region; c=a[y0:y1,x0:x1]
    if kind=='dist':
        if bg is None: bg=np.median(np.concatenate([c[:2].reshape(-1,3),c[-2:].reshape(-1,3)]),0)
        al=sstep(np.abs(c-bg).max(-1),*p)
    elif kind=='hi': al=sstep(lum(c),*p)
    else: al=1-sstep(lum(c),*p)
    b=bbox_alpha(al,0.25); return (x0+b[0],x0+b[1],y0+b[2],y0+b[3])
T=extract(load('vasco_third'),(600,940,0,90),'dist',(25,90))
def run():
    W=185; TOP=10
    jobs={'atletico-mg_away':(25,25,25),'atletico-mg_home':(246,246,246),'vasco_away':(24,24,24),'vasco_home':(246,246,246)}
    for k,col in jobs.items():
        a=load(k)
        ib=ink_box(a,(600,940,0,64),'dist',(60,140))
        print(k,ib)
        cx=(ib[0]+ib[1])/2
        erase(a,(ib[0]-8,ib[1]+8,0,ib[3]+6))
        t=resize(tint(T,col),W)
        paste(a,t,cx-t.shape[1]/2,TOP)
        save(k,a)

if __name__=='__main__': run()
