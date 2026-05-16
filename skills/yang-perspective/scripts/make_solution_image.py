from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).resolve().parents[1] / "yang-triangle-solution.png"


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


SCALE = 2
W, H = 1400, 1900
img = Image.new("RGB", (W * SCALE, H * SCALE), "#f7f8fb")
draw = ImageDraw.Draw(img)


def sc(v):
    return int(v * SCALE)


def box(x0, y0, x1, y1, fill="#ffffff", outline="#d9dee8", width=2, r=20):
    draw.rounded_rectangle(
        [sc(x0), sc(y0), sc(x1), sc(y1)],
        radius=sc(r),
        fill=fill,
        outline=outline,
        width=sc(width),
    )


def text(x, y, s, size=34, fill="#111827", bold=False, anchor=None):
    draw.text((sc(x), sc(y)), s, font=font(sc(size), bold), fill=fill, anchor=anchor)


def line(points, fill="#111827", width=4):
    draw.line([(sc(x), sc(y)) for x, y in points], fill=fill, width=sc(width), joint="curve")


def wrap_text(s, max_chars):
    lines = []
    cur = ""
    for ch in s:
        cur += ch
        if len(cur) >= max_chars and ch in "，。；、 ":
            lines.append(cur.strip())
            cur = ""
    if cur:
        lines.append(cur.strip())
    return lines


def paragraph(x, y, s, size=31, fill="#374151", max_chars=35, gap=45, bold=False):
    yy = y
    for ln in wrap_text(s, max_chars):
        text(x, yy, ln, size=size, fill=fill, bold=bold)
        yy += gap
    return yy


# Header
draw.rectangle([0, 0, W * SCALE, sc(170)], fill="#111827")
text(60, 42, "Yang 视角：先看题眼，再选工具", 46, "#ffffff", True)
text(60, 108, "D 是 BC 中点 + 角条件  ->  中线 / 向量 / 坐标最省", 28, "#c7d2fe")

# Problem card
box(60, 210, 1340, 380, fill="#ffffff")
text(95, 242, "题目", 34, "#2563eb", True)
text(180, 244, "在 ΔABC 中，D 为 BC 的中点，且 ∠DAC + ∠BAC = π。", 31)
text(180, 302, "① 求 AB / AD        ② 若 BC = 2√2 AC，求 cos C", 31)

# Diagram card
box(60, 420, 660, 890, fill="#ffffff")
text(95, 452, "图形信号", 34, "#2563eb", True)

A = (155, 780)
C = (550, 780)
B = (355, 535)
D = ((B[0] + C[0]) / 2, (B[1] + C[1]) / 2)
line([A, B, C, A], "#1f2937", 5)
line([A, D], "#ef4444", 5)
line([B, C], "#1f2937", 5)
for p, name, dx, dy in [(A, "A", -25, 20), (B, "B", -10, -45), (C, "C", 18, 10), (D, "D", 18, -10)]:
    draw.ellipse([sc(p[0]-7), sc(p[1]-7), sc(p[0]+7), sc(p[1]+7)], fill="#111827")
    text(p[0]+dx, p[1]+dy, name, 28, "#111827", True)
text(185, 820, "AD 是中线", 26, "#ef4444", True)
text(155, 500, "∠BAC = A", 25, "#6b7280")
text(350, 680, "∠DAC = π - A", 25, "#6b7280")

# Signal card
box(700, 420, 1340, 890, fill="#ffffff")
text(735, 452, "这题别急着算", 34, "#2563eb", True)
y = 515
items = [
    ("1", "D 是 BC 中点：先想到中线长公式。"),
    ("2", "角条件很怪：把角关系翻译成 cos A。"),
    ("3", "坐标放法最省：A 放原点，AC 放 x 轴。"),
    ("4", "先求 AB 与 AD 的关系，再处理第 2 问。"),
]
for num, s in items:
    draw.ellipse([sc(735), sc(y-5), sc(775), sc(y+35)], fill="#dbeafe")
    text(755, y+2, num, 23, "#1d4ed8", True, anchor="mm")
    paragraph(795, y-4, s, 28, "#374151", 24, 39)
    y += 88

# Main derivation
box(60, 930, 1340, 1445, fill="#ffffff")
text(95, 965, "关键翻译：把角条件变成边长关系", 34, "#2563eb", True)
eqs = [
    "设 AC = b，AB = c，∠BAC = A。",
    "A 放原点，AC 放 x 轴：C=(b,0)，B=(c cosA, c sinA)。",
    "D 是 BC 中点，所以 D=((b+c cosA)/2, c sinA/2)。",
    "tan∠DAC = c sinA / (b + c cosA)。",
    "又 ∠DAC = π - A，所以 tan∠DAC = -tanA。",
    "整理得：  c/(b+c cosA) = -1/cosA  ->  cosA = -b/(2c)。",
]
y = 1030
for i, s in enumerate(eqs, 1):
    text(100, y, f"{i}.", 27, "#2563eb", True)
    paragraph(145, y-3, s, 27, "#111827", 48, 38)
    y += 67

# Answers
box(60, 1490, 650, 1790, fill="#ecfdf5", outline="#86efac")
text(95, 1522, "① 求 AB / AD", 32, "#047857", True)
ans1 = [
    "BC² = b² + c² - 2bc cosA",
    "代 cosA = -b/(2c)：BC² = c² + 2b²",
    "中线长：AD² = (2c² + 2b² - BC²)/4 = c²/4",
    "所以 AD = c/2，AB/AD = c/(c/2) = 2",
]
y = 1582
for s in ans1:
    text(95, y, "· " + s, 24, "#064e3b")
    y += 46
text(95, 1740, "答案：AB / AD = 2", 34, "#047857", True)

box(700, 1490, 1340, 1790, fill="#fff7ed", outline="#fdba74")
text(735, 1522, "② 求 cos C", 32, "#c2410c", True)
ans2 = [
    "已知 BC = 2√2 b，所以 BC² = 8b²",
    "又 BC² = c² + 2b²，得 c² = 6b²",
    "cosC = (BC² + AC² - AB²) / (2·BC·AC)",
    "= (8b² + b² - 6b²)/(4√2 b²) = 3√2/8",
]
y = 1582
for s in ans2:
    text(735, y, "· " + s, 24, "#7c2d12")
    y += 46
text(735, 1740, "答案：cos C = 3√2 / 8", 34, "#c2410c", True)

# Footer
text(60, 1830, "一句话总结：中点给中线，角条件锁 cosA；先拿到 cosA = -AC/(2AB)，后面就是公式收尾。", 28, "#4b5563")

img = img.resize((W, H), Image.Resampling.LANCZOS)
img.save(OUT)
print(OUT)
