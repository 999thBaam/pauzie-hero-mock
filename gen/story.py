"""How-it-works story panels (portrait 1024x1536), one heroine across all panels.
usage: python3 story.py p1            -> generate panel 1 (sets the character)
       python3 story.py p2 p3 ...     -> edits: panel 1 (character) + device render as references
Writes ../assets/story/raw/<id>.png
"""
import base64, json, os, sys, urllib.request, concurrent.futures as cf

KEY = next(l.split('=', 1)[1].strip().strip('"') for l in open(os.path.expanduser('~/.config/voicebench/keys.env')) if l.startswith('OPENAI_API_KEY='))
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'assets', 'story', 'raw')
DEVICE = os.path.expanduser('~/Desktop/pact-device-v1/r-pact-3q.png')
os.makedirs(OUT, exist_ok=True)

STYLE = ("Flat editorial illustration with subtle grain texture, simple rounded shapes, clean confident linework, playful and a little "
         "cartoonish, warm palette of cream, peach, sage green and dark pine green. Tall portrait composition with the main action in the "
         "middle and lower two thirds; keep the top quarter calm and simple (plain wall or sky) because text will sit there. "
         "No text, no letters, no numbers, no logos, no app icons, no UI, no watermark.")
HEROINE = ("The heroine: Riya, a 22-year-old Indian woman, shoulder-length wavy black hair, small round glasses, mustard kurta "
           "over light jeans, expressive face.")
DEVICE_D = ("The Pauzie device: a small cream-white rounded-square puck about the size of a coaster, thick and soft-edged, with a "
            "dark olive capybara-shaped letter P and a small olive dot on its top face, exactly like the object in the second reference image.")

PANELS = {
  'p1': "Late night in her small bedroom. Riya sits at a study desk piled with open books and a laptop, but she is slumped, thumb "
        "scrolling her phone, face lit blue by the screen, a wall clock showing it is very late, a half-drunk cup of chai gone cold. "
        "Funny, relatable guilt: one eyebrow raised at herself.",
  'p2': "Daytime, same bedroom. Riya kneels on the floor opening a small delivery box; inside sits the Pauzie device on paper "
        "padding, giving off a soft warm glow like treasure. She looks delighted and curious.",
  'p3': "Same desk in bright morning light. Close, low angle: Riya's hand taps her phone onto the Pauzie device lying on the desk; "
        "a small ring of warm light ripples out from the touch. Riya's determined smiling face in the background.",
  'p4': "Whimsical: the Pauzie device stands upright on the desk like a tiny brave knight, wearing a small shining silver helmet "
        "with a plume and holding a little olive shield, bravely holding back a swarm of cute, mischievous cartoon creatures made of "
        "notification bubbles, red dots, hearts and play-button shapes. Behind the knight, Riya studies calmly and happily, unbothered.",
  'p5': "Close, slightly low angle, same composition as the third reference image: Riya's hand presses her phone flat DOWN ONTO the top of "
        "the Pauzie device lying on the desk, the phone clearly touching the device, a ring of warm light rippling out from the touch point. "
        "The task is clearly finished: a closed notebook with a ribbon bookmark on a neat stack of closed books, laptop shut, evening window. "
        "Riya's other hand is raised in a happy fist pump, big relieved grin. A playful burst of small cartoon speech bubbles, red dots and "
        "little hearts springs up out of the phone screen like confetti. No animals anywhere.",
  'k1': "Close-up, low angle, the phone and padlock fill the lower half of the frame. Riya, lying on her bed at night, holds her glowing phone; "
        "a BIG brass padlock is clamped over the phone, and her own fingers are TURNING THE KEY that is stuck in it, the shackle popping open. "
        "Out of the phone screen burst playful cartoon reels, hearts, play buttons and red notification dots, pulling her in. Her face: a guilty, "
        "sheepish grin. The message must be obvious without words: the key is right on the lock, so she unlocks it herself in one second. "
        "No other gadgets, no device, no puck anywhere in the picture.",
  'k2': "Deep perspective composition showing DISTANCE. Foreground: Riya at her study desk, calm and focused, writing; her phone lies on the desk "
        "with a BIG brass padlock firmly CLOSED around it, no key anywhere near. Background: through an open doorway, down a long hallway, in ANOTHER "
        "ROOM far away, the Pauzie device sits high on a shelf with a big brass key hanging from it like a keychain, softly glowing. A faint dotted "
        "path on the floor leads from her chair, through the doorway, all the way to the far shelf. The cartoon reels and notification creatures sit "
        "outside the closed padlock, bored and sulking. The message must be obvious without words: the key is far away, so the phone stays locked.",
  'p6': "Funny and clear: in her home, Riya stands on tiptoe on a small wooden stool, reaching up to place the Pauzie device on top of a very "
        "tall steel almirah (Indian cupboard), far out of reach. Her phone lies face-down on the study desk below, already locked. "
        "Her mother in the doorway watches, amused, arms crossed. Playful sense of 'hide it so you can't cheat'. No animals anywhere.",
}

def post(url, body, ctype):
    req = urllib.request.Request(url, data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=400) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, 'HTTP %s %s' % (e.code, e.read()[:300])

def gen(pid):
    prompt = f"{STYLE} {HEROINE} Scene: {PANELS[pid]}"
    d, err = post("https://api.openai.com/v1/images/generations",
                  json.dumps({"model": "gpt-image-2", "prompt": prompt, "size": "1024x1536", "quality": "medium", "n": 1}).encode(),
                  "application/json")
    if err: return pid, err
    open(os.path.join(OUT, pid + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return pid, 'ok'

def edit(pid):
    prompt = (f"Use the first reference image ONLY for the heroine's look (same face, hair, glasses, clothes) and the illustration style. "
              f"{STYLE} {HEROINE} {'' if pid == 'k1' else DEVICE_D} New scene: {PANELS[pid]}")
    bnd = '----pauzie' + os.urandom(6).hex()
    parts = [f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
             for k, v in (('model', 'gpt-image-2'), ('prompt', prompt), ('size', '1024x1536'), ('quality', 'medium'))]
    refs = [os.path.join(OUT, 'p1.png')] + ([] if pid == 'k1' else [DEVICE]) + ([os.path.join(OUT, 'p3.png')] if pid == 'p5' else [])
    for path in refs:
        parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n'.encode()
                     + open(path, 'rb').read() + b'\r\n')
    parts.append(f'--{bnd}--\r\n'.encode())
    d, err = post("https://api.openai.com/v1/images/edits", b''.join(parts), f"multipart/form-data; boundary={bnd}")
    if err: return pid, err
    open(os.path.join(OUT, pid + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return pid, 'ok'

ids = sys.argv[1:]
with cf.ThreadPoolExecutor(5) as ex:
    for pid, st in ex.map(lambda i: gen(i) if i == 'p1' else edit(i), ids):
        print(pid, st, flush=True)
