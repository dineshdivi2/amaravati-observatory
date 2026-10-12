"""Dependency-free geometry helpers shared by the collectors (Python 3.9+, stdlib only)."""
import math

# --- Projection: UTM (WGS84) -> longitude/latitude -------------------------------------------
# APCRDA services store geometry in EPSG:32644 (UTM 44N) and fail to reproject server-side for
# many layers, so collectors request native coordinates and convert here (Kruger series, <1 mm).
_A = 6378137.0
_F = 1 / 298.257223563
_K0 = 0.9996
_N = _F / (2 - _F)
_AA = _A / (1 + _N) * (1 + _N ** 2 / 4 + _N ** 4 / 64)
_BETA = (_N / 2 - 2 * _N ** 2 / 3 + 37 * _N ** 3 / 96,
         _N ** 2 / 48 + _N ** 3 / 15,
         17 * _N ** 3 / 480)
_DELTA = (2 * _N - 2 * _N ** 2 / 3 - 2 * _N ** 3,
          7 * _N ** 2 / 3 - 8 * _N ** 3 / 5,
          56 * _N ** 3 / 15)


def utm_to_lonlat(easting, northing, zone, north=True):
    x = (easting - 500000.0) / (_K0 * _AA)
    y = (northing if north else northing - 10000000.0) / (_K0 * _AA)
    xi, eta = y, x
    for j, b in enumerate(_BETA, start=1):
        xi -= b * math.sin(2 * j * y) * math.cosh(2 * j * x)
        eta -= b * math.cos(2 * j * y) * math.sinh(2 * j * x)
    chi = math.asin(math.sin(xi) / math.cosh(eta))
    lat = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(_DELTA, start=1))
    lon0 = math.radians(zone * 6 - 183)
    lon = lon0 + math.atan2(math.sinh(eta), math.cos(xi))
    return math.degrees(lon), math.degrees(lat)


def projector(wkid):
    """Return a function (x, y) -> (lon, lat) for the supported service spatial references."""
    if wkid in (4326, None):
        return lambda x, y: (x, y)
    if 32601 <= wkid <= 32660:
        zone = wkid - 32600
        return lambda x, y: utm_to_lonlat(x, y, zone, True)
    if wkid in (3857, 102100, 102113):
        return lambda x, y: (math.degrees(x / _A), math.degrees(2 * math.atan(math.exp(y / _A)) - math.pi / 2))
    raise ValueError(f'Unsupported spatial reference {wkid}')


# --- Simplification ---------------------------------------------------------------------------
def simplify(points, tolerance):
    """Douglas-Peucker on planar coordinates (metres). Keeps endpoints; iterative."""
    if tolerance <= 0 or len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    tol2 = tolerance * tolerance
    while stack:
        start, end = stack.pop()
        ax, ay = points[start]
        bx, by = points[end]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        best, index = -1.0, -1
        for i in range(start + 1, end):
            px, py = points[i]
            if length2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > best:
                best, index = d2, i
        if best > tol2:
            keep[index] = True
            stack.extend(((start, index), (index, end)))
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(ring, tolerance):
    out = simplify(ring, tolerance)
    if len(out) < 4:  # a closed ring needs at least 3 distinct vertices
        return ring if len(ring) >= 4 else None
    return out


# --- Rings -----------------------------------------------------------------------------------
def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:])) / 2


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def rings_to_polygons(rings):
    """Group Esri rings into polygons: clockwise rings are shells, counter-clockwise are holes."""
    shells, holes = [], []
    for ring in rings:
        if len(ring) < 4:
            continue
        (shells if signed_area(ring) < 0 else holes).append(ring)
    if not shells:  # some sources ignore orientation; treat every ring as a shell
        shells, holes = holes, []
    polygons = [[shell] for shell in shells]
    for hole in holes:
        owner = next((p for p in polygons if point_in_ring(hole[0], p[0])), polygons[-1])
        owner.append(hole)
    return polygons


def stitch(ways):
    """Join open OSM member ways into closed rings by matching endpoints."""
    pending = [list(w) for w in ways if len(w) >= 2]
    rings = []
    while pending:
        ring = pending.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, way in enumerate(pending):
                if way[0] == ring[-1]:
                    ring += way[1:]
                elif way[-1] == ring[-1]:
                    ring += way[-2::-1]
                elif way[-1] == ring[0]:
                    ring = way[:-1] + ring
                elif way[0] == ring[0]:
                    ring = way[:0:-1] + ring
                else:
                    continue
                pending.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def round_coords(value, digits=6):
    if value and isinstance(value[0], (int, float)):
        return [round(value[0], digits), round(value[1], digits)]
    return [round_coords(v, digits) for v in value]


def walk_coords(coords):
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for c in coords:
            yield from walk_coords(c)
