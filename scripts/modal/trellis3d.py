# Vibrex 3D 생성 서버 — Microsoft TRELLIS(MIT) 를 Modal GPU 서버리스에서 돌린다.
# 배포: python3 -m modal deploy scripts/modal/trellis3d.py
# 비밀값: modal secret create vibrex-3d AUTH_TOKEN=<임의 문자열>  (Vercel 의 MODAL_3D_TOKEN 과 같은 값)
#
# POST /submit  {mode:'image'|'text', image_b64?, image_url?, prompt?, seed?} → {id}
# GET  /result/{id}            → {status:'running'} | {status:'done', glb_bytes} | {status:'failed', error}
# GET  /result/{id}/glb|thumb  → 파일 바이트
import io
import os

import modal

app = modal.App("vibrex-3d")
cache = modal.Volume.from_name("vibrex-3d-cache", create_if_missing=True)
CACHE = "/cache"

ARCH = "8.6;8.9"  # A10G · L4
image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "libgl1", "libglib2.0-0", "libxrender1", "libsm6", "libxext6", "libgomp1", "libegl1", "libopengl0", "libglvnd0", "libglx0", "libx11-6", "libusb-1.0-0", "libgomp1", "build-essential", "ninja-build")
    .pip_install("torch==2.4.0", "torchvision==0.19.0", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install("xformers==0.0.27.post2", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install(
        "pillow", "imageio", "imageio-ffmpeg", "tqdm", "easydict", "opencv-python-headless", "scipy", "ninja",
        "rembg", "onnxruntime", "trimesh", "open3d", "xatlas", "pyvista", "pymeshfix", "igraph",
        "transformers==4.46.3", "huggingface_hub", "safetensors", "spconv-cu120", "fastapi[standard]",
        "git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8",
    )
    .pip_install("kaolin", find_links="https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html")
    .pip_install("wheel", "setuptools<70")
    .env({"TORCH_CUDA_ARCH_LIST": ARCH, "FORCE_CUDA": "1", "CC": "gcc", "CXX": "g++"})
    .run_commands(
        "git clone --branch v0.3.3 --depth 1 https://github.com/NVlabs/nvdiffrast /tmp/nvdiffrast && pip install --no-build-isolation /tmp/nvdiffrast",
        "git clone --recursive https://github.com/autonomousvision/mip-splatting /tmp/mip && pip install --no-build-isolation /tmp/mip/submodules/diff-gaussian-rasterization/",
        "git clone --depth 1 https://github.com/microsoft/TRELLIS /trellis",
    )
    .run_commands("cd /trellis && git submodule update --init --recursive --depth 1")  # flexicubes
    .env({
        "PYTHONPATH": "/trellis", "ATTN_BACKEND": "xformers", "SPCONV_ALGO": "native",
        "HF_HOME": f"{CACHE}/hf", "TORCH_HOME": f"{CACHE}/torch", "U2NET_HOME": f"{CACHE}/u2net",
    })
)

# 입체화 — 2D 그림을 '3D 로 렌더한 피규어' 이미지로 다시 그린다 (Qwen-Image-Edit-2509, Apache 2.0) → TRELLIS 가 둥근 입체를 만든다
edit_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("git+https://github.com/huggingface/diffusers", "transformers>=4.51", "accelerate", "sentencepiece", "protobuf", "huggingface_hub[hf_transfer]", "pillow", "rembg", "onnxruntime")
    .env({"HF_HOME": f"{CACHE}/hf", "HF_HUB_ENABLE_HF_TRANSFER": "1", "U2NET_HOME": f"{CACHE}/u2net"})
)
VOLUMIZE = ("Turn this 2D drawing into a high-quality 3D rendered figurine of the same character: rounded volumetric body and head, "
            "soft vinyl toy material, same design, colors, face and proportions, full body, front view, standing in a relaxed A-pose with arms held slightly away from the body and legs slightly apart, centered, "
            "plain pure white background, soft studio lighting, no outlines, no text.")

# 자동 리깅 — VAST UniRig(MIT): GLB → 뼈대 예측 → 스킨 가중치 → 원본에 합쳐 리깅된 GLB (bpy 4.2 로 입출력)
import subprocess  # noqa: E402
import tempfile  # noqa: E402

UNIRIG = "/UniRig"
rig_image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "git-lfs", "libgl1", "libegl1", "libglib2.0-0", "libxrender1", "libxi6", "libxkbcommon0", "libsm6", "libxext6", "libxfixes3", "libxxf86vm1", "libusb-1.0-0", "libgomp1", "build-essential")
    .pip_install("torch==2.3.1", "torchvision==0.18.1", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install("https://github.com/Dao-AILab/flash-attention/releases/download/v2.6.3/flash_attn-2.6.3+cu123torch2.3cxx11abiFALSE-cp311-cp311-linux_x86_64.whl")
    .pip_install("torch_scatter", "torch_cluster", find_links="https://data.pyg.org/whl/torch-2.3.0+cu121.html")
    .pip_install("transformers==4.51.3", "python-box", "einops", "omegaconf", "pytorch_lightning", "lightning", "addict", "timm",
                 "fast-simplification", "bpy==4.2", "trimesh", "open3d", "pyrender", "huggingface_hub", "spconv-cu120", "scipy", "numpy==1.26.4")
    .run_commands(f"GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/VAST-AI-Research/UniRig {UNIRIG}")
    .env({"HF_HOME": "/cache/hf", "PYOPENGL_PLATFORM": "egl"})
)


def _run(cmd: list[str]):
    r = subprocess.run(cmd, cwd=UNIRIG, capture_output=True, text=True)
    if r.returncode != 0 or "Traceback" in (r.stderr or ""):
        raise RuntimeError(f"{' '.join(cmd[:3])} failed:\n{(r.stdout or '')[-1500:]}\n{(r.stderr or '')[-3000:]}")
    return r


def rig_glb(glb: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, skel, skin, out = (os.path.join(d, n) for n in ("in.glb", "skeleton.fbx", "skin.fbx", "rigged.glb"))
        open(src, "wb").write(glb)
        _run(["bash", "launch/inference/generate_skeleton.sh", "--input", src, "--output", skel])
        _run(["bash", "launch/inference/generate_skin.sh", "--input", skel, "--output", skin])
        _run(["bash", "launch/inference/merge.sh", "--source", skin, "--target", src, "--output", out])
        if not os.path.exists(out):
            raise RuntimeError("merge produced no output")
        # 움직임 클립을 GLB 안에 굽는다 — 실패해도 뼈대만 있는 GLB 는 돌려준다
        anim = os.path.join(d, "animated.glb")
        open(os.path.join(d, "bake.py"), "w").write(BAKE)
        open(os.path.join(d, "face.py"), "w").write(FACE)
        # Blender 는 드라코 라이브러리 경고 등을 stderr 로 내므로 결과 파일로만 성공을 판단한다
        r = subprocess.run(["python", os.path.join(d, "bake.py"), out, anim, os.path.join(d, "face.py")], cwd=UNIRIG, capture_output=True, text=True)
        print("bake:", (r.stdout or "")[-400:])
        if os.path.exists(anim) and os.path.getsize(anim) > 1000:
            return open(anim, "rb").read()
        print("bake failed:", (r.stdout or "")[-800:], (r.stderr or "")[-1500:])
        return open(out, "rb").read()


FACE = r"""
# 얼굴(눈·입) 찾기 + 블렌드셰이프(blink, mouth_open) — 이미 불러온 장면에서 동작. 결과는 FACE_INFO 딕셔너리
import bpy, numpy as np
from mathutils import Vector
FACE_INFO = {'ok': False}
def add_face():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes: return
    ob = max(meshes, key=lambda o: len(o.data.vertices))
    me = ob.data
    # 텍스처
    img = None
    for m in me.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: img = n.image; break
        if img: break
    if img is None: return
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, img.channels)[:, :, :3]
    # 정점 위치·법선(월드)·UV
    n = len(me.vertices)
    co = np.array([ob.matrix_world @ v.co for v in me.vertices])
    nm = np.array([(ob.matrix_world.to_3x3() @ v.normal).normalized() for v in me.vertices])
    uv = np.zeros((n, 2)); cnt = np.zeros(n)
    uvl = me.uv_layers.active.data
    for loop in me.loops:
        uv[loop.vertex_index] += uvl[loop.index].uv; cnt[loop.vertex_index] += 1
    uv /= np.maximum(cnt, 1)[:, None]
    col = px[np.clip((uv[:, 1] * (H - 1)).astype(int), 0, H - 1), np.clip((uv[:, 0] * (W - 1)).astype(int), 0, W - 1)]
    lum = col @ np.array([0.299, 0.587, 0.114])
    zmin, zmax = co[:, 2].min(), co[:, 2].max(); h = zmax - zmin
    # 앞을 보는 정점 (Blender 앞 = -Y), 위쪽(머리) 영역
    front = (nm[:, 1] < -0.35) & (co[:, 2] > zmin + h * 0.28)   # 모자·머리가 크면 얼굴이 낮게 있다
    idx = np.where(front)[0]
    if len(idx) < 50: return
    # 앞에서 본 그림을 텍스처로 직접 그린다(소프트웨어 래스터) — 정점만으론 얼굴이 너무 성겨 눈·입이 안 보인다
    tris_all = [(p_.index, p_.vertices[0], p_.vertices[i], p_.vertices[i + 1], p_.loop_indices[0], p_.loop_indices[i], p_.loop_indices[i + 1]) for p_ in me.polygons for i in range(1, len(p_.vertices) - 1)]
    head = [t for t in tris_all if front[t[1]] or front[t[2]] or front[t[3]]]
    P3 = co[idx]
    x0, x1, z0, z1 = P3[:, 0].min(), P3[:, 0].max(), P3[:, 2].min(), P3[:, 2].max()
    G = 192
    sx = (G - 1) / max(1e-6, x1 - x0); sz = (G - 1) / max(1e-6, z1 - z0)
    depth = np.full((G, G), 1e9); colmap = np.zeros((G, G, 3)); posmap = np.zeros((G, G, 3)); have = np.zeros((G, G), bool); tri_id = -np.ones((G, G), int)
    for ti, (pi, a, b, c_, la, lb, lc) in enumerate(head):
        P = co[[a, b, c_]]
        if np.cross(P[1] - P[0], P[2] - P[0])[1] > 0: continue   # 뒤를 보는 면
        X = (P[:, 0] - x0) * sx; Z = (P[:, 2] - z0) * sz
        gx0, gx1 = max(0, int(np.floor(X.min()))), min(G - 1, int(np.ceil(X.max())))
        gz0, gz1 = max(0, int(np.floor(Z.min()))), min(G - 1, int(np.ceil(Z.max())))
        if gx1 < gx0 or gz1 < gz0: continue
        us_, vs_ = np.meshgrid(np.arange(gx0, gx1 + 1), np.arange(gz0, gz1 + 1))
        den = (Z[1] - Z[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Z[0] - Z[2])
        if abs(den) < 1e-9: continue
        w1 = ((Z[1] - Z[2]) * (us_ - X[2]) + (X[2] - X[1]) * (vs_ - Z[2])) / den
        w2 = ((Z[2] - Z[0]) * (us_ - X[2]) + (X[0] - X[2]) * (vs_ - Z[2])) / den
        w3 = 1 - w1 - w2
        ins = (w1 >= -1e-3) & (w2 >= -1e-3) & (w3 >= -1e-3)
        if not ins.any(): continue
        Y = w1 * P[0, 1] + w2 * P[1, 1] + w3 * P[2, 1]
        UVt = np.array([uvl[la].uv[:], uvl[lb].uv[:], uvl[lc].uv[:]])
        uu = w1 * UVt[0, 0] + w2 * UVt[1, 0] + w3 * UVt[2, 0]; vv = w1 * UVt[0, 1] + w2 * UVt[1, 1] + w3 * UVt[2, 1]
        gzz, gxx = vs_[ins], us_[ins]
        closer = Y[ins] < depth[gzz, gxx]
        gzz, gxx = gzz[closer], gxx[closer]
        depth[gzz, gxx] = Y[ins][closer]
        colmap[gzz, gxx] = px[np.clip((vv[ins][closer] * (H - 1)).astype(int), 0, H - 1), np.clip((uu[ins][closer] * (W - 1)).astype(int), 0, W - 1)]
        posmap[gzz, gxx, 0] = (w1 * P[0, 0] + w2 * P[1, 0] + w3 * P[2, 0])[ins][closer]
        posmap[gzz, gxx, 1] = Y[ins][closer]
        posmap[gzz, gxx, 2] = (w1 * P[0, 2] + w2 * P[1, 2] + w3 * P[2, 2])[ins][closer]
        have[gzz, gxx] = True; tri_id[gzz, gxx] = ti
    VISIBLE = set(np.unique(tri_id[tri_id >= 0]).tolist())
    L = np.where(have, colmap @ np.array([0.299, 0.587, 0.114]), np.nan)
    global FRONT_MAP, FRONT_TF; FRONT_MAP = colmap; FRONT_TF = (x0, z0, sx, sz, G)
    med = np.nanmedian(L)
    dark = have & (L < min(med * 0.55, med - 0.18))
    best = np.where(have, 1, -1)
    # 이웃 연결 덩어리
    lab = np.zeros((G, G), dtype=int); comps = []; c = 0
    for i in range(G):
        for j in range(G):
            if dark[i, j] and not lab[i, j]:
                c += 1; st = [(i, j)]; lab[i, j] = c; cells = []
                while st:
                    a, b = st.pop(); cells.append((a, b))
                    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        u, v = a + da, b + db
                        if 0 <= u < G and 0 <= v < G and dark[u, v] and not lab[u, v]: lab[u, v] = c; st.append((u, v))
                if len(cells) >= 3: comps.append(cells)
    if not comps: return
    def info(cells):
        a = np.array(cells)
        p = posmap[a[:, 0], a[:, 1]]
        r0, r1, c0, c1 = a[:, 0].min(), a[:, 0].max(), a[:, 1].min(), a[:, 1].max()
        hh_, ww_ = r1 - r0 + 1, c1 - c0 + 1
        # 둘레(덩어리 크기만큼 넓힌 테두리)의 밝기 — 눈은 밝은 피부·흰자에 둘러싸여 있다
        R0, R1, C0, C1 = max(0, r0 - hh_), min(G - 1, r1 + hh_), max(0, c0 - ww_), min(G - 1, c1 + ww_)
        ring = L[R0:R1 + 1, C0:C1 + 1].copy(); ring[r0 - R0:r1 - R0 + 1, c0 - C0:c1 - C0 + 1] = np.nan
        return {'x': p[:, 0].mean(), 'z': p[:, 2].mean(), 'y': p[:, 1].min(), 'w': np.ptp(p[:, 0]) + 1e-4, 'hh': np.ptp(p[:, 2]) + 1e-4, 'n': len(cells),
                'asp': ww_ / hh_, 'gr': c0 + ww_ / 2, 'ring': np.nanmedian(ring) if np.isfinite(ring).any() else 0, 'lum': np.nanmean(L[a[:, 0], a[:, 1]])}
    C = [info(cc) for cc in comps if len(cc) < G * G * 0.03]
    span = x1 - x0
    cx = (x0 + x1) / 2
    # 눈: 좌우 한 쌍 — 비슷한 높이·크기, 둥근 모양, 밝은 둘레, 적당한 간격
    pair, score = None, -1
    for a_ in C:
        for b_ in C:
            if not (a_['x'] < b_['x']): continue
            gap = b_['x'] - a_['x']
            if not (span * 0.12 < gap < span * 0.65): continue
            if abs(a_['z'] - b_['z']) > max(a_['hh'], b_['hh']) * 0.8 + span * 0.02: continue
            if max(a_['n'], b_['n']) > 2.5 * min(a_['n'], b_['n']): continue
            if not all(0.35 < q['asp'] < 2.8 and q['ring'] > q['lum'] + 0.2 for q in (a_, b_)): continue
            if abs((a_['x'] + b_['x']) / 2 - cx) > span * 0.2: continue
            rnd = min(min(q['asp'], 1 / q['asp']) for q in (a_, b_))   # 둥글수록
            s_ = min(a_['n'], b_['n']) ** 0.5 * min(a_['ring'], b_['ring']) ** 3 * rnd   # 크기보다 '밝은 둘레·둥근 모양' 을 중시(머리카락 덩어리 배제)
            if s_ > score: score, pair = s_, (a_, b_)
    if not pair: return
    eL, eR = pair
    ez = (eL['z'] + eR['z']) / 2; spread = eR['x'] - eL['x']
    mouth = None; mid = (eL['x'] + eR['x']) / 2; want = ez - spread * 0.62
    for m_ in C:
        if m_ is eL or m_ is eR: continue
        if ez - spread * 1.2 < m_['z'] < ez - spread * 0.3 and abs(m_['x'] - mid) < spread * 0.22:
            if not mouth or abs(m_['z'] - want) < abs(mouth['z'] - want): mouth = m_
    if mouth is None:
        mouth = {'x': (eL['x'] + eR['x']) / 2, 'z': ez - spread * 0.55, 'y': min(eL['y'], eR['y']), 'w': spread * 0.35, 'hh': spread * 0.08, 'n': 0}
    # ── 텍스처에 '눈 감음'·'입 벌림' 을 칠한 판을 만든다 (얼굴 메시는 성겨서 정점을 움직여도 눈·입 그림이 거의 안 바뀐다)
    fr = nm[:, 1] < -0.05
    def paint(base, regions):
        out = base.copy()
        for (cx_, cz_, rx, rz, fy, fn) in regions:
            for ti in VISIBLE:
                pi_, a_, b_, c2, la, lb, lc = head[ti]
                t = (a_, b_, c2); tuv = (tuple(uvl[la].uv[:]), tuple(uvl[lb].uv[:]), tuple(uvl[lc].uv[:]))
                P = co[list(t)]
                if ((((P[:, 0] - cx_) / rx) ** 2 + ((P[:, 2] - cz_) / rz) ** 2)).min() > 1.6: continue
                if P[:, 1].min() > fy + spread * 0.22: continue   # 얼굴 앞면만 (뒤통수·안쪽 면 제외)
                U = np.array(tuv) * np.array([W - 1, H - 1])
                u0, v0 = np.floor(U.min(0)).astype(int); u1, v1 = np.ceil(U.max(0)).astype(int)
                if u1 - u0 > W * 0.3 or v1 - v0 > H * 0.3: continue
                us, vs = np.meshgrid(np.arange(u0, u1 + 1), np.arange(v0, v1 + 1))
                A, B, Cc = U
                den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1])
                if abs(den) < 1e-9: continue
                w1 = ((B[1] - Cc[1]) * (us - Cc[0]) + (Cc[0] - B[0]) * (vs - Cc[1])) / den
                w2 = ((Cc[1] - A[1]) * (us - Cc[0]) + (A[0] - Cc[0]) * (vs - Cc[1])) / den
                w3 = 1 - w1 - w2
                ins = (w1 >= -0.02) & (w2 >= -0.02) & (w3 >= -0.02)
                if not ins.any(): continue
                X = w1 * P[0, 0] + w2 * P[1, 0] + w3 * P[2, 0]; Z = w1 * P[0, 2] + w2 * P[1, 2] + w3 * P[2, 2]
                dx, dz = (X - cx_) / rx, (Z - cz_) / rz
                m = ins & (dx * dx + dz * dz <= 1)
                if not m.any(): continue
                uu, vv = us[m], vs[m]
                ok = (uu >= 0) & (uu < W) & (vv >= 0) & (vv < H)
                out[vv[ok], uu[ok]] = fn(dx[m][ok], dz[m][ok], out[vv[ok], uu[ok]])
        return out
    # 눈 둘레 피부색
    def ring_color(e):
        # 눈 바로 아래 볼(앞에서 본 그림)의 밝은 피부색
        gx = int((e['x'] - x0) * sx); gz = int((e['z'] - z0) * sz); dh = max(2, int(e['hh'] * sz)); dw = max(2, int(e['w'] * sx))
        reg = colmap[max(0, gz - dh * 2):max(1, gz - dh), max(0, gx - dw // 2):gx + dw // 2 + 1].reshape(-1, 3)
        lum_ = reg @ np.array([0.299, 0.587, 0.114])
        good = reg[lum_ > np.percentile(lum_, 40)] if len(reg) else reg
        return np.median(good, axis=0) if len(good) else np.array([0.95, 0.8, 0.7])
    regions_blink = []
    for e in (eL, eR):
        skin = ring_color(e); rx, rz = max(e['w'], spread * 0.16) * 0.75, max(e['hh'], spread * 0.1) * 0.75
        lash = np.array([0.12, 0.08, 0.07])
        def fn(dx, dz, cur, skin=skin, lash=lash):
            o = np.tile(skin, (len(dx), 1))
            line = np.abs(dz + 0.15 - 0.25 * dx * dx) < 0.18   # 살짝 웃는 곡선의 속눈썹 선
            o[line] = lash
            return o
        regions_blink.append((e['x'], e['z'], rx, rz, e['y'], fn))
    mrx, mrz = max(mouth['w'], spread * 0.22) * 0.75, spread * 0.13
    def mfn(dx, dz, cur):
        o = np.tile(np.array([0.32, 0.05, 0.08]), (len(dx), 1))
        o[dz < -0.35] = np.array([0.85, 0.42, 0.45])   # 혀
        o[(dx * dx + dz * dz) > 0.78] = np.array([0.45, 0.12, 0.12])   # 입술 테두리
        return o
    regions_mouth = [(mouth['x'], mouth['z'] - mrz * 0.35, mrx, mrz, mouth['y'], mfn)]
    t_blink = paint(px, regions_blink); t_mouth = paint(px, regions_mouth); t_both = paint(t_blink, regions_mouth)
    def mkimg(name, arr):
        im = bpy.data.images.new(name, W, H, alpha=False)
        a4 = np.concatenate([arr, np.ones((H, W, 1), dtype=np.float32)], axis=2)
        im.pixels.foreach_set(a4.ravel()); im.file_format = 'JPEG'; im.pack()
        return im
    # 숨긴 아주 작은 메시에 붙여 GLB 안에 같이 들어가게 (게임의 makeAlive 가 이름으로 찾아 바꿔 낀다)
    for nm_, arr in (('face_blink', t_blink), ('face_mouth', t_mouth), ('face_both', t_both)):
        im = mkimg(nm_, arr)
        mat = bpy.data.materials.new(nm_); mat.use_nodes = True
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = im
        mat.node_tree.links.new(tex.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
        mesh = bpy.data.meshes.new('__' + nm_)
        c0 = ob.matrix_world @ Vector((0, 0, 0))
        e = 1e-4
        mesh.from_pydata([(0, 0, 0), (e, 0, 0), (0, 0, e)], [], [(0, 1, 2)]); mesh.materials.append(mat)
        mesh.uv_layers.new()
        o2 = bpy.data.objects.new('__' + nm_, mesh); o2.location = c0
        bpy.context.scene.collection.objects.link(o2)
    FACE_INFO.update({'ok': True, 'eyes': [(eL['x'], eL['z']), (eR['x'], eR['z'])], 'mouth': (mouth['x'], mouth['z']), 'found_mouth': mouth['n'] > 0})
"""

FACE_ONLY = r"""
import sys, bpy
exec(open(sys.argv[3]).read())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[1])
for a in bpy.data.actions: a.use_fake_user = True
add_face()
print('face', FACE_INFO)
bpy.ops.export_scene.gltf(filepath=sys.argv[2], export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88)
"""


def face_glb(glb: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, "in.glb"), os.path.join(d, "face.glb")
        open(src, "wb").write(glb)
        open(os.path.join(d, "f.py"), "w").write(FACE_ONLY); open(os.path.join(d, "face.py"), "w").write(FACE)
        r = subprocess.run(["python", os.path.join(d, "f.py"), src, out, os.path.join(d, "face.py")], cwd=UNIRIG, capture_output=True, text=True)
        print("face:", (r.stdout or "")[-400:], (r.stderr or "")[-600:])
        if not os.path.exists(out) or "'ok': True" not in (r.stdout or ""):
            raise RuntimeError("얼굴(눈·입)을 찾지 못했어요")
        return open(out, "rb").read()


# Blender(bpy) 로 뼈대 구조에서 다리·팔·머리를 찾아 idle·walk·run·jump·attack·happy·hit 클립을 키프레임으로 만든다.
# (Blender 는 Z 위, 앞은 -Y) 이름 없는 자동 리깅 뼈(bone_N)라 위치·구조로 판별 — 게임 쪽 THREE.makeAlive 와 같은 규칙
BAKE = r"""
import sys, math, bpy
from mathutils import Vector, Quaternion
src, dst = sys.argv[1], sys.argv[2]
FACE_SRC = open(sys.argv[3]).read() if len(sys.argv) > 3 else ''
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
M = arm.matrix_world
B = arm.data.bones
pos = {b.name: M @ b.tail_local for b in B}
leaves = [b for b in B if not b.children]
zs = [M @ b.head_local for b in B] + list(pos.values())   # 뼈 위치로 범위를 잡는다(메시 좌표계는 다를 수 있다)
root = next(b for b in B if b.parent is None)
zmin, zmax = min(v.z for v in zs), max(v.z for v in zs)
xmin, xmax = min(v.x for v in zs), max(v.x for v in zs)
h, w, cx = max(1e-3, zmax - zmin), max(1e-3, xmax - xmin), (M @ root.head_local).x
top = max(leaves, key=lambda b: pos[b.name].z)
low = [b for b in leaves if (pos[b.name].z - zmin) / h < 0.3]
legL = min([b for b in low if pos[b.name].x >= cx] or [None], key=lambda b: pos[b.name].z if b else 0)
legR = min([b for b in low if pos[b.name].x < cx] or [None], key=lambda b: pos[b.name].z if b else 0)
rest = [b for b in leaves if b not in (legL, legR, top) and abs(pos[b.name].x - cx) > w * 0.05]
armL = max([b for b in rest if pos[b.name].x > cx] or [None], key=lambda b: pos[b.name].x if b else 0)
armR = min([b for b in rest if pos[b.name].x < cx] or [None], key=lambda b: pos[b.name].x if b else 0)
def path(b):
    p = []
    while b: p.insert(0, b); b = b.parent
    return p
def after(a, b):
    pa, pb = path(a), path(b) if b else []
    i = 0
    while i < len(pa) and i < len(pb) and pa[i] == pb[i]: i += 1
    return pa[i:]
def chain(a, b, drop=False):
    if not a: return []
    c = after(a, b) if b else path(a)[-2:]
    return c[1:] if drop and len(c) >= 3 else c
LL, LR = chain(legL, legR), chain(legR, legL)
AL, AR = chain(armL, armR or top, True), chain(armR, armL or top, True)
HEAD = [top.parent or top] if top else []
SPINE = [b for b in path(top)[:3]] if top else []
PB = arm.pose.bones
def q(bone, axis, ang):
    loc = (M.to_3x3() @ bone.matrix_local.to_3x3()).inverted() @ Vector(axis)
    return Quaternion(loc.normalized(), ang)
FPS = 30
bpy.context.scene.render.fps = FPS
def clip(name, seconds, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    n = max(2, int(seconds * FPS))
    for f in range(n + 1):
        t = f / n
        poses = fn(t)
        for b in B:
            pb = PB[b.name]; pb.rotation_mode = 'QUATERNION'
            r = Quaternion()
            for (bone, axis, ang) in poses.get(b.name, []): r = q(bone, axis, ang) @ r
            pb.rotation_quaternion = r
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    arm.animation_data.action = None
def put(d, bones, axis, ang, idx=0):
    if len(bones) > idx: d.setdefault(bones[idx].name, []).append((bones[idx], axis, ang))
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
def gait(sw, knee):
    def fn(t):
        s = math.sin(t * 2 * math.pi); d = {}
        put(d, LL, X, -s * sw); put(d, LR, X, s * sw)
        put(d, LL, X, max(0, s) * knee, 1); put(d, LR, X, max(0, -s) * knee, 1)
        put(d, AL, X, s * sw * 0.8); put(d, AR, X, -s * sw * 0.8)
        for sp in SPINE[1:2]: put(d, [sp], Z, s * 0.06)
        return d
    return fn
def idle(t):
    s = math.sin(t * 2 * math.pi); d = {}
    put(d, HEAD, Z, s * 0.15); put(d, AL, X, s * 0.05); put(d, AR, X, -s * 0.05)
    for sp in SPINE[1:2]: put(d, [sp], X, s * 0.03)
    return d
def jump(t):
    e = math.sin(t * math.pi); d = {}
    put(d, LL, X, -0.5 * e); put(d, LR, X, -0.5 * e); put(d, LL, X, 0.9 * e, 1); put(d, LR, X, 0.9 * e, 1)
    put(d, AL, Y, -1.4 * e); put(d, AR, Y, 1.4 * e)
    return d
def attack(t):
    e = math.sin(min(1, t * 1.6) * math.pi); d = {}
    put(d, AR, X, -1.9 * e); put(d, AL, X, 0.3 * e)
    for sp in SPINE[1:2]: put(d, [sp], Z, -0.25 * e)
    return d
def happy(t):
    e = abs(math.sin(t * 2 * math.pi)); d = {}
    put(d, AL, Y, -2.2 * e); put(d, AR, Y, 2.2 * e); put(d, HEAD, X, -0.15 * e)
    return d
def hit(t):
    e = math.sin(t * math.pi) * (1 - t * 0.5); d = {}
    put(d, HEAD, X, 0.4 * e); put(d, AL, Y, -0.6 * e); put(d, AR, Y, 0.6 * e)
    for sp in SPINE[1:2]: put(d, [sp], X, 0.25 * e)
    return d
clip('idle', 2.4, idle); clip('walk', 0.9, gait(0.5, 0.7)); clip('run', 0.55, gait(0.85, 1.1))
def talk(t):
    s2 = math.sin(t * 4 * math.pi); d = {}
    put(d, HEAD, X, -0.08 * s2); put(d, HEAD, Z, 0.06 * math.sin(t * 2 * math.pi))
    put(d, AR, X, -0.35 - 0.25 * math.sin(t * 2 * math.pi)); put(d, AR, Y, 0.25)
    for sp in SPINE[1:2]: put(d, [sp], Z, 0.05 * math.sin(t * 2 * math.pi))
    return d
clip('jump', 0.8, jump); clip('attack', 0.5, attack); clip('happy', 0.9, happy); clip('hit', 0.45, hit); clip('talk', 1.6, talk)
try:
    exec(FACE_SRC); add_face(); print('face', FACE_INFO)
except Exception as e:
    print('face failed', e)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88)
print('baked', [a.name for a in bpy.data.actions])
"""


web_image = modal.Image.debian_slim(python_version="3.10").pip_install("fastapi[standard]")


@app.cls(image=image, gpu="A10G", volumes={CACHE: cache}, timeout=600, scaledown_window=120, max_containers=3)
class Trellis:
    @modal.enter()
    def load(self):
        import torch  # noqa: F401
        from trellis.pipelines import TrellisImageTo3DPipeline
        self.img = TrellisImageTo3DPipeline.from_pretrained("JeffreyXiang/TRELLIS-image-large")
        self.img.cuda()
        self.txt = None
        cache.commit()

    def _text_pipeline(self):
        if self.txt is None:
            from trellis.pipelines import TrellisTextTo3DPipeline
            self.txt = TrellisTextTo3DPipeline.from_pretrained("JeffreyXiang/TRELLIS-text-large")
            self.txt.cuda()
            cache.commit()
        return self.txt

    @modal.method()
    def generate(self, mode: str, image_bytes: bytes | None = None, prompt: str = "", seed: int = 1) -> dict:
        from PIL import Image
        from trellis.utils import postprocessing_utils

        thumb = None
        args = dict(seed=seed, formats=["gaussian", "mesh"],
                    sparse_structure_sampler_params={"steps": 12, "cfg_strength": 7.5},
                    slat_sampler_params={"steps": 12, "cfg_strength": 3})
        if mode == "text":
            out = self._text_pipeline().run(prompt, **args)
        else:
            im = self._cutout(Image.open(io.BytesIO(image_bytes)))
            pre = self.img.preprocess_image(im)          # 배경 제거·가운데 정렬 → 썸네일로도 쓴다
            b = io.BytesIO(); pre.save(b, "PNG"); thumb = b.getvalue()
            out = self.img.run(pre, preprocess_image=False, **args)
        glb = postprocessing_utils.to_glb(out["gaussian"][0], out["mesh"][0], simplify=0.95, texture_size=1024, verbose=False)
        if thumb is None:
            thumb = self._render_thumb(out["gaussian"][0])
        # TRELLIS 는 metallicFactor 를 비워 둔다 → glTF 기본값 1(완전 금속)이라 게임·뷰어에서 색이 검게 죽는다 → 비금속으로
        for geom in getattr(glb, "geometry", {glb: glb}).values():
            mat = getattr(getattr(geom, "visual", None), "material", None)
            if mat is not None and hasattr(mat, "metallicFactor"):
                mat.metallicFactor = 0.0
                mat.roughnessFactor = 0.85
        buf = io.BytesIO(); glb.export(buf, file_type="glb")
        return {"glb": buf.getvalue(), "thumb": thumb}

    def _cutout(self, im):
        """배경 제거 — 이미 투명하면 그대로, 아니면 BiRefNet(MIT). TRELLIS 기본(u2net)은 검은·복잡한 배경을 자주 못 뗀다"""
        im = im.convert("RGBA")
        import numpy as np
        a = np.array(im)[:, :, 3]
        if (a < 250).mean() > 0.02:
            return im
        if getattr(self, "bg", None) is None:
            from rembg import new_session
            self.bg = new_session("birefnet-general")
        from rembg import remove
        return remove(im.convert("RGB"), session=self.bg)

    def _render_thumb(self, gaussian) -> bytes | None:
        try:
            from PIL import Image
            from trellis.utils import render_utils
            frames = render_utils.render_video(gaussian, num_frames=1, resolution=512, bg_color=(1, 1, 1))["color"]
            b = io.BytesIO(); Image.fromarray(frames[0]).save(b, "PNG"); return b.getvalue()
        except Exception:
            return None


@app.cls(image=edit_image, gpu="H100", volumes={CACHE: cache}, timeout=900, scaledown_window=120, max_containers=2)
class Volumize:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import QwenImageEditPlusPipeline
        self.pipe = QwenImageEditPlusPipeline.from_pretrained("Qwen/Qwen-Image-Edit-2509", torch_dtype=torch.bfloat16).to("cuda")
        cache.commit()

    @modal.method()
    def edit(self, image_bytes: bytes, hint: str = "") -> bytes:
        import torch
        from PIL import Image
        im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg.convert("RGB")
        prompt = VOLUMIZE + (f" The character is: {hint}." if hint else "")
        out = self.pipe(image=[im], prompt=prompt, negative_prompt=" ", true_cfg_scale=4.0, num_inference_steps=28,
                        guidance_scale=1.0, generator=torch.Generator("cuda").manual_seed(7)).images[0]
        b = io.BytesIO(); out.save(b, "PNG"); return b.getvalue()


# 이미지 생성 — Qwen-Image (Apache 2.0, gated 아님, 한국어·영어 프롬프트 이해). AI 이미지와 글 → 3D 의 첫 단계에 쓴다
FIGURE = ("A high-quality 3D rendered figurine of {p}. Full body, single character, front view, standing in a relaxed A-pose with arms held slightly away from the body and legs slightly apart, hands not touching the body, centered, "
          "rounded volumetric shapes, soft vinyl toy material, plain pure white background, soft studio lighting, no text.")


@app.cls(image=edit_image, gpu="H100", volumes={CACHE: cache}, timeout=900, scaledown_window=120, max_containers=2)
class QwenImage:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import DiffusionPipeline
        self.pipe = DiffusionPipeline.from_pretrained("Qwen/Qwen-Image", torch_dtype=torch.bfloat16).to("cuda")
        self.bg = None
        cache.commit()

    @modal.method()
    def generate(self, prompt: str, n: int = 4, width: int = 1024, height: int = 1024, transparent: bool = False, seed: int | None = None, fmt: str = "WEBP") -> dict:
        import random

        import torch
        seed = seed if seed is not None else random.randint(0, 2**31 - 1)
        out = []
        for i in range(max(1, min(n, 4))):
            im = self.pipe(prompt=prompt, negative_prompt=" ", width=width, height=height, num_inference_steps=30, true_cfg_scale=4.0,
                           generator=torch.Generator("cuda").manual_seed(seed + i)).images[0]
            if transparent:
                if self.bg is None:
                    from rembg import new_session
                    self.bg = new_session("isnet-general-use")
                from rembg import remove
                im = remove(im, session=self.bg)
            b = io.BytesIO(); im.save(b, fmt, **({"quality": 90} if fmt == "WEBP" else {})); out.append(b.getvalue())
        return {"images": out, "seed": seed}


@app.cls(image=rig_image, gpu="A10G", volumes={"/cache": cache}, timeout=900, scaledown_window=120, max_containers=2)
class Rigger:
    @modal.method()
    def face(self, glb: bytes) -> dict:
        return {"glb": face_glb(glb)}

    @modal.method()
    def rig(self, glb: bytes) -> dict:
        out = rig_glb(glb)
        cache.commit()
        return {"glb": out}


@app.function(image=web_image, timeout=1500)
def text_then_3d(prompt: str, seed: int = 1, rig: bool = False) -> dict:
    """글 → 피규어 렌더 이미지(Qwen-Image) → TRELLIS (→ 자동 리깅). TRELLIS 자체 글→3D 는 짧은 영어만 알아들어 설명과 다른 모양이 나온다"""
    ref = QwenImage().generate.remote(FIGURE.format(p=prompt), 1, 1024, 1024, False, seed, "PNG")["images"][0]
    r = Trellis().generate.remote("image", ref, "", seed)
    r["ref"] = ref
    return _maybe_rig(r, rig)


def _maybe_rig(r: dict, rig: bool) -> dict:
    """뼈대·움직임 클립까지 — 실패하면(사람·동물 모양이 아닌 경우 등) 움직임 없는 모델을 그대로 돌려준다"""
    if not rig:
        return r
    try:
        r["glb"] = Rigger().rig.remote(r["glb"])["glb"]
        r["rigged"] = True
    except Exception as e:  # noqa: BLE001
        print("rig failed:", str(e)[:500])
        r["rigged"] = False
    return r


@app.function(image=web_image, timeout=1500)
def image_then_3d(image_bytes: bytes, seed: int = 1, rig: bool = False) -> dict:
    return _maybe_rig(Trellis().generate.remote("image", image_bytes, "", seed), rig)


@app.function(image=web_image, timeout=1500)
def volumize_then_3d(image_bytes: bytes, hint: str = "", seed: int = 1, rig: bool = False) -> dict:
    """2D → 입체 렌더 이미지 → TRELLIS. 결과에 입체 렌더 이미지(ref)도 담는다"""
    ref = Volumize().edit.remote(image_bytes, hint)
    r = Trellis().generate.remote("image", ref, "", seed)
    r["ref"] = ref
    return _maybe_rig(r, rig)


@app.function(image=web_image, secrets=[modal.Secret.from_name("vibrex-3d")])
@modal.asgi_app()
def api():
    import base64
    import urllib.request

    from fastapi import FastAPI, Header, HTTPException, Response

    web = FastAPI()

    def auth(token: str | None):
        if not token or token != f"Bearer {os.environ['AUTH_TOKEN']}":
            raise HTTPException(401, "unauthorized")

    @web.post("/submit")
    def submit(body: dict, authorization: str | None = Header(None)):
        auth(authorization)
        if body.get("mode") == "rig":  # 자동 리깅
            glb = base64.b64decode(body["glb_b64"]) if body.get("glb_b64") else urllib.request.urlopen(str(body.get("glb_url")), timeout=60).read()
            if not glb or len(glb) > 40_000_000:
                raise HTTPException(400, "glb required")
            call = (Rigger().face if body.get("face_only") else Rigger().rig).spawn(glb)
            return {"id": call.object_id}
        if body.get("mode") == "img":  # 이미지 생성
            prompt = str(body.get("prompt") or "")[:1000]
            if not prompt:
                raise HTTPException(400, "prompt required")
            w, h = int(body.get("width") or 1024), int(body.get("height") or 1024)
            w, h = max(256, min(1440, w // 16 * 16)), max(256, min(1440, h // 16 * 16))
            call = QwenImage().generate.spawn(prompt, int(body.get("n") or 4), w, h, bool(body.get("transparent")), body.get("seed"))
            return {"id": call.object_id}
        mode = "text" if body.get("mode") == "text" else "image"
        img = None
        if mode == "image":
            if body.get("image_b64"):
                img = base64.b64decode(body["image_b64"])
            elif body.get("image_url"):
                img = urllib.request.urlopen(body["image_url"], timeout=30).read()
            if not img or len(img) > 10_000_000:
                raise HTTPException(400, "image required")
        prompt = str(body.get("prompt") or "")[:300]
        if mode == "text" and not prompt:
            raise HTTPException(400, "prompt required")
        if mode == "text":
            call = text_then_3d.spawn(prompt, int(body.get("seed") or 1), bool(body.get("rig")))
        elif mode == "image" and body.get("volumize"):
            call = volumize_then_3d.spawn(img, str(body.get("hint") or "")[:200], int(body.get("seed") or 1), bool(body.get("rig")))
        else:
            call = image_then_3d.spawn(img, int(body.get("seed") or 1), bool(body.get("rig")))
        return {"id": call.object_id}

    def result(id: str):
        try:
            return modal.FunctionCall.from_id(id).get(timeout=0)
        except TimeoutError:
            return None

    @web.get("/result/{id}")
    def status(id: str, authorization: str | None = Header(None)):
        auth(authorization)
        try:
            r = result(id)
        except Exception as e:  # 생성 중 오류
            return {"status": "failed", "error": str(e)[:300]}
        if r is None:
            return {"status": "running"}
        if "images" in r:
            return {"status": "done", "images": len(r["images"]), "seed": r.get("seed")}
        return {"status": "done", "glb_bytes": len(r["glb"]), "thumb": bool(r.get("thumb")), "ref": bool(r.get("ref")), "rigged": r.get("rigged")}

    @web.get("/result/{id}/{part}")
    def file(id: str, part: str, authorization: str | None = Header(None)):
        auth(authorization)
        r = result(id)
        if r is not None and part.startswith("img") and part[3:].isdigit() and int(part[3:]) < len(r.get("images", [])):
            return Response(r["images"][int(part[3:])], media_type="image/webp")
        if r is None or part not in ("glb", "thumb", "ref") or not r.get(part):
            raise HTTPException(404, "not ready")
        return Response(r[part], media_type="model/gltf-binary" if part == "glb" else "image/png")  # ref·thumb 는 PNG

    return web


@app.function(image=image, timeout=600)
def smoke():
    """GPU 없이 import 만 확인 — python3 -m modal run scripts/modal/trellis3d.py::smoke"""
    from trellis.pipelines import TrellisImageTo3DPipeline, TrellisTextTo3DPipeline  # noqa: F401
    from trellis.utils import postprocessing_utils, render_utils  # noqa: F401
    print("imports ok")
