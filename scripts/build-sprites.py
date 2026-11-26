"""
Build the Daily Heist 2D sprites from the source sheets in assets/sprites/source/.

Uses only sprite-gen's free, offline tools (no provider is called, nothing is billed):
  - `sprite-gen cutout`  removes the white background (real alpha, no white fringe),
  - `sprite-gen shadow`  projects a soft ground shadow from each figure's silhouette.
Then this script groups each sheet's three figures by connected pixels (a grid slice clips props
such as Vale's scroll that cross the column lines), trims, bakes the shadow under the feet, and
exports WebP: <name>-<view>.webp (256 px tall) and <name>-<view>-sm.webp (128 px, Smooth mode).
The side view faces right; the game mirrors it in CSS for facing left (no extra file).

Usage (with sprite-gen installed in a virtualenv that also has numpy, scipy and Pillow):
  SPRITE_GEN=path/to/sprite-gen python scripts/build-sprites.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "sprites" / "source"
OUT = ROOT / "src" / "client" / "art" / "sprites"
SG = os.environ.get("SPRITE_GEN", "sprite-gen")

CHARS = ["vale", "wren", "oto", "guard"]
VIEWS = ["front", "side", "back"]
CANVAS = (176, 256)  # every view shares one canvas so the game can anchor feet the same way
FEET_Y = 238  # feet sit here; the shadow spreads below
FIG_H = 228  # the tallest figure of a sheet is this tall; the others keep their drawn size
QUALITY = 84


def run(*args: str) -> str:
    r = subprocess.run([SG, *args], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"sprite-gen {args[0]} failed:\n{r.stdout}\n{r.stderr}")
    return r.stdout


def figures(cut: Image.Image) -> list[Image.Image]:
    """The three figures of a sheet, left to right, each with every prop that belongs to it."""
    px = np.asarray(cut)
    a = px[:, :, 3]
    solid = a > 32
    eight = np.ones((3, 3))
    # Figures can touch (a prop held out reaches the next view). Erode until there are three
    # separate cores, then grow each core back through its own pixels (watershed): a prop stays
    # with the figure it is attached to, even where it touches a neighbour.
    cores = None
    for k in range(0, 16):
        core = ndimage.binary_erosion(solid, structure=eight, iterations=k) if k else solid
        lab, n = ndimage.label(core, structure=eight)
        sizes = ndimage.sum(core, lab, index=range(1, n + 1))
        big = [i + 1 for i in np.argsort(sizes)[::-1] if sizes[i] > 0.05 * solid.sum()]
        if len(big) >= 3:
            boxes = ndimage.find_objects(lab)
            cores = (lab, sorted(big[:3], key=lambda i: boxes[i - 1][1].start))
            break
    if cores is None:
        sys.exit("could not find three figures on the sheet")
    lab, order = cores
    # Geodesic grow: each core claims one ring of pixels per step, only through visible pixels;
    # the first core to reach a pixel owns it.
    inside = a > 0
    region = np.zeros(a.shape, np.int8)
    for j, i in enumerate(order):
        region[lab == i] = j + 1
    while True:
        free = inside & (region == 0)
        if not free.any():
            break
        grown = False
        claims = []
        for j in range(1, 4):
            ring = ndimage.binary_dilation(region == j, structure=eight) & free
            claims.append(ring)
        for j, ring in enumerate(claims, start=1):
            ring &= region == 0  # a tie goes to the earlier figure
            if ring.any():
                region[ring] = j
                grown = True
        if not grown:
            break  # what is left is not connected to any figure (specks)
    out = []
    for j in range(1, 4):
        mine = (region == j) & (a > 0)
        # drop specks that ended up here (keep real props, which are larger)
        l2, n2 = ndimage.label(mine, structure=eight)
        if n2 > 1:
            s2 = ndimage.sum(mine, l2, index=range(1, n2 + 1))
            mine = np.isin(l2, [i + 1 for i in range(n2) if s2[i] >= 150])
        p = px.copy()
        p[~mine] = 0
        im = Image.fromarray(p)
        out.append(im.crop(im.getbbox()))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict[str, dict] = {}
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        for c in CHARS:
            cut_path = t / f"{c}-cut.png"
            run("cutout", str(SRC / f"{c}-sheet.png"), "--key", "white", "--out", str(cut_path))
            figs = figures(Image.open(cut_path).convert("RGBA"))
            scale = FIG_H / max(f.height for f in figs)
            for view, fig in zip(VIEWS, figs):
                w, h = round(fig.width * scale), round(fig.height * scale)
                if w > CANVAS[0] - 4:  # a wide pose (a held prop) is shrunk to fit, feet kept
                    w, h = CANVAS[0] - 4, round(h * (CANVAS[0] - 4) / w)
                fig = fig.resize((w, h), Image.LANCZOS)
                fig_path = t / f"{c}-{view}.png"
                fig.save(fig_path)
                sh_dir = t / f"{c}-{view}-shadow"
                run("shadow", "--source", str(fig_path), "--out-dir", str(sh_dir),
                    "--anchor-x", str(w // 2), "--anchor-y", str(h - 1),
                    "--squash", "0.12", "--shear", "0", "--opacity", "0.42", "--blur", "5")
                meta = json.loads((sh_dir / "shadow.asset.json").read_text())
                ax, ay = meta["anchor"]
                shadow = Image.open(sh_dir / "shadow.png").convert("RGBA")
                canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
                fx, fy = (CANVAS[0] - w) // 2, FEET_Y - h
                canvas.alpha_composite(shadow, (round(fx + w // 2 - ax), round(FEET_Y - ay)))
                canvas.alpha_composite(fig, (fx, fy))
                canvas.save(OUT / f"{c}-{view}.webp", "WEBP", quality=QUALITY, method=6)
                small = canvas.resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS)
                small.save(OUT / f"{c}-{view}-sm.webp", "WEBP", quality=QUALITY - 6, method=6)
                report[f"{c}-{view}"] = {"w": w, "h": h, "feet": [CANVAS[0] // 2, FEET_Y]}
    # The office floor: layer 1 as drawn; layers 2 and 3 are colour-graded in CSS.
    room = Image.open(SRC / "room-office.png").convert("RGB")
    room.resize((640, 640), Image.LANCZOS).save(OUT / "room-office.webp", "WEBP", quality=78, method=6)
    room.resize((320, 320), Image.LANCZOS).save(OUT / "room-office-sm.webp", "WEBP", quality=72, method=6)
    total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
    (OUT / "sprites.json").write_text(json.dumps({"canvas": CANVAS, "views": report}, indent=1) + "\n")
    print(f"{len(list(OUT.glob('*.webp')))} files, {total / 1024:.0f} KB total in {OUT}")


if __name__ == "__main__":
    main()
