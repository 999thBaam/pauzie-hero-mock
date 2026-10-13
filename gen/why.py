"""'Why Pauzie' mock images.
A = Odyssey frieze (black-figure Greek vase painting, 1536x1024). C = Indian hiding habits (vintage matchbox-label print, 1024x1024).
usage: python3 why.py a1 c1          -> first panel of each set (sets the look)
       python3 why.py a2 a3 a4 c2 ... -> edits using the set's first panel (+ device render where needed)
Writes ../assets/why/raw/<id>.png
"""
import base64, json, os, sys, urllib.request, concurrent.futures as cf

KEY = next(l.split('=', 1)[1].strip().strip('"') for l in open(os.path.expanduser('~/.config/voicebench/keys.env')) if l.startswith('OPENAI_API_KEY='))
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'why', 'raw')
DEVICE = os.path.expanduser('~/Desktop/pact-device-v1/r-pact-3q.png')
os.makedirs(OUT, exist_ok=True)

A_STYLE = ("Ancient Greek black-figure vase painting, flat terracotta orange ground, figures in glossy black silhouette with fine "
           "incised cream detail lines, a meander (Greek key) band along the top and bottom edges, wide frieze composition read left "
           "to right, elegant and witty. No text, no letters, no logos, no watermark.")
C_STYLE = ("Vintage Indian matchbox-label / screen-print poster style: bold flat shapes, limited palette of mustard yellow, brick red, "
           "teal, cream and black, slight misregistration and halftone dots, thick outline, a decorative border, warm and funny, "
           "modern Indian characters. No text, no letters, no numbers, no logos, no watermark.")
DEV = ("The Pauzie device: a small cream-white rounded-square puck with a dark olive capybara-shaped letter P and a small dot on top, "
       "like the object in the last reference image (drawn in this picture's style).")

P = {
  'a1': ('A', "The Sirens episode of the Odyssey: a Greek ship with a big square sail sails past rocky islands; on the rocks sit "
              "Sirens (bird-bodied women) each holding up a glowing smartphone, wavy song-lines flowing from the phones toward the ship. "
              "Odysseus stands tied tightly to the mast with ropes, straining toward them; the rowers row on calmly."),
  'a2': ('A', "Close frieze of the same ship: the rowers have their ears plugged with little round wax balls and look straight ahead, "
              "smiling; Odysseus, tied to the mast, cranes his neck toward the singing phone-Sirens but cannot move; one rower "
              "tightens the knot. The ship is safely passing."),
  'a3': ('A', "Same black-figure style, but a modern scene: a young person sits on a sofa holding a smartphone; a tiny Siren climbs "
              "OUT of the phone screen holding a pair of scissors and cheerfully cuts the rope that ties the person's wrist to a small "
              "mast-like pole beside the sofa. Witty, the trap is inside the phone itself."),
  'a4': ('A', "Same black-figure style, modern scene: a young person works happily at a desk, phone lying face down; far across the "
              "room, high on a distant shelf like the top of a mast, sits the Pauzie device, painted in cream; the little phone-Sirens "
              "sit sulking on the floor, unable to reach it. Calm and victorious."),
  'c1': ('C', "An Indian mother on tiptoe hides a round steel box of laddoos on the very top kitchen shelf, while her young son "
              "below watches longingly, mouth watering."),
  'c2': ('C', "A teenage girl drops a coin into a round clay gullak (piggy bank) on a table, proud; a small hammer lies untouched "
              "beside it, with the gullak clearly needing to be smashed to get the money out."),
  'c3': ('C', "Before exams, a college student hands his motorbike keys to his elder sister, who pockets them with a grin; his "
              "textbooks under his arm, the bike parked outside the window."),
  'c4': ('C', "A young Indian woman places the Pauzie device on the very top kitchen shelf right next to the steel laddoo box, "
              "her phone lying face down on the counter below; her mother in the background gives an approving thumbs up."),
}
SIZE = {'A': '1536x1024', 'C': '1024x1024'}
STYLE = {'A': A_STYLE, 'C': C_STYLE}

def post(url, body, ctype):
    req = urllib.request.Request(url, data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=400) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, 'HTTP %s %s' % (e.code, e.read()[:300])

def run(pid):
    s, scene = P[pid]
    first = pid[0] + '1'
    if pid == first:
        d, err = post("https://api.openai.com/v1/images/generations",
                      json.dumps({"model": "gpt-image-2", "prompt": f"{STYLE[s]} Scene: {scene}", "size": SIZE[s], "quality": "medium", "n": 1}).encode(),
                      "application/json")
    else:
        needs_dev = pid in ('a4', 'c4')
        prompt = (f"Use the first reference image ONLY for the exact art style, palette and border. {STYLE[s]} "
                  + (DEV + ' ' if needs_dev else '') + f"New scene: {scene}")
        bnd = '----pauzie' + os.urandom(6).hex()
        parts = [f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
                 for k, v in (('model', 'gpt-image-2'), ('prompt', prompt), ('size', SIZE[s]), ('quality', 'medium'))]
        for path in [os.path.join(OUT, first + '.png')] + ([DEVICE] if needs_dev else []):
            parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n'.encode()
                         + open(path, 'rb').read() + b'\r\n')
        parts.append(f'--{bnd}--\r\n'.encode())
        d, err = post("https://api.openai.com/v1/images/edits", b''.join(parts), f"multipart/form-data; boundary={bnd}")
    if err: return pid, err
    open(os.path.join(OUT, pid + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return pid, 'ok'

with cf.ThreadPoolExecutor(5) as ex:
    for pid, st in ex.map(run, sys.argv[1:]):
        print(pid, st, flush=True)
