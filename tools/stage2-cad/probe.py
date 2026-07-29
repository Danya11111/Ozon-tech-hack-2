# Probe FreeCAD semantics for links/placements on conveer.FCStd
import FreeCAD

doc = FreeCAD.openDocument("/home/coder/arhipovdan/app/3d_models/conveer.FCStd")

def bb(s):
    b = s.BoundBox
    return f"({b.XMin:.0f},{b.YMin:.0f},{b.ZMin:.0f})..({b.XMax:.0f},{b.YMax:.0f},{b.ZMax:.0f})"

def pmt(p):
    return f"pos=({p.Base.x:.0f},{p.Base.y:.0f},{p.Base.z:.0f}) axis=({p.Rotation.Axis.x:.2f},{p.Rotation.Axis.y:.2f},{p.Rotation.Axis.z:.2f}) angle={p.Rotation.Angle:.3f}"

names = ["Body002", "Body003", "Body010", "Body018", "Body019", "Link005", "Link007", "Link016", "Link025", "Link027", "Link028", "Link000", "Link"]
for n in names:
    o = doc.getObject(n)
    if o is None:
        print(n, "MISSING")
        continue
    print(f"== {n} type={o.TypeId} label={o.Label.encode('ascii','replace').decode()}")
    print("   placement:", pmt(o.Placement) if hasattr(o, "Placement") else "n/a")
    if hasattr(o, "getGlobalPlacement"):
        try:
            print("   global:", pmt(o.getGlobalPlacement()))
        except Exception as e:
            print("   global ERROR:", e)
    else:
        print("   global: NO METHOD")
    try:
        print("   shape bbox:", bb(o.Shape))
    except Exception as e:
        print("   shape ERROR:", e)
    if o.TypeId == "App::Link":
        try:
            lo = o.LinkedObject
            print("   linked:", lo.Name, lo.TypeId, lo.Label.encode('ascii','replace').decode())
            if hasattr(lo, "Shape"):
                print("   linked shape bbox:", bb(lo.Shape))
            if hasattr(lo, "Placement"):
                print("   linked placement:", pmt(lo.Placement))
            if lo.TypeId == "App::DocumentObjectGroup":
                for ch in lo.Group:
                    print(f"      child {ch.Name} {ch.TypeId} place={pmt(ch.Placement) if hasattr(ch,'Placement') else 'n/a'} bbox={bb(ch.Shape) if hasattr(ch,'Shape') else 'n/a'}")
        except Exception as e:
            print("   linked ERROR:", e)
    # group membership: which group contains this object
    for g in doc.Objects:
        if g.TypeId == "App::DocumentObjectGroup" and hasattr(g, "Group") and o in g.Group:
            print("   member of group:", g.Name, g.Label.encode('ascii','replace').decode())
FreeCAD.closeDocument(doc.Name)
