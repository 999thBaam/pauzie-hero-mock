"""Generate paired strip scenes (night = hooked, day = free) with OpenAI gpt-image-2.
usage: python3 gen.py [ids...]   e.g. dinner-night dinner-day ; no args = all
Key read from ~/.config/voicebench/keys.env (OPENAI_API_KEY). Writes ../assets/scenes/raw/<id>.png
"""
import base64, json, os, sys, urllib.request, concurrent.futures as cf

KEY = next(l.split('=', 1)[1].strip().strip('"') for l in open(os.path.expanduser('~/.config/voicebench/keys.env')) if l.startswith('OPENAI_API_KEY='))
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'scenes', 'raw')
os.makedirs(OUT, exist_ok=True)

STYLE = ("Flat editorial illustration with subtle grain texture, simple rounded shapes, clean confident linework, "
         "modern Indian characters (varied ages, everyday Indian clothes and homes), expressive body language, "
         "wide 3:2 composition, characters fill the frame, no text, no letters, no logos, no UI, no watermark.")
NIGHT = ("Mood: gloomy but beautiful late night. Palette of deep indigo, navy and muted violet; the ONLY light is the cold "
         "blue-white glow of phone screens lighting their faces from below. Everyone is hunched, heads down, eyes glued "
         "to their own phone, ignoring each other. Tired, absorbed, disconnected.")
DAY = ("Mood: calm, warm and joyful early morning. Palette of soft cream, warm peach sunlight, sage green and dark pine "
       "green accents. No phones visible anywhere (or one lying face-down, forgotten). People look up, at each other and "
       "the world, smiling, present, relaxed.")

SCENES = {
  'dinner':  ("A family of four at a dinner table at home, each person staring at their own phone, food going cold.",
              "The same family of four at the dinner table laughing and talking together, passing a bowl of dal and rotis."),
  'student': ("A college student at a desk piled with textbooks at midnight, scrolling short videos on a phone instead of studying.",
              "The same student at the desk in morning light, focused, writing notes in a notebook, phone face-down on the side."),
  'bed':     ("A young couple lying in bed in the dark, back to back, each lit by their own phone screen.",
              "The same young couple on a small balcony at sunrise sharing cups of chai and talking."),
  'metro':   ("A crowded Mumbai local train compartment, every passenger bent over a phone.",
              "The same train compartment, passengers chatting, one reading a book, one looking out at the sunrise through the open door."),
  'cafe':    ("Four friends around a small cafe table, all silently scrolling their phones, cutting chai untouched.",
              "The same four friends at the cafe table laughing loudly together over cutting chai."),
  'kid':     ("A young child on a sofa glued to a tablet in a dark room, the screen glow on their face.",
              "The same child on a rooftop terrace flying a bright kite, laughing, a parent beside them."),
  'walk':    ("People walking on a busy Indian street at night, all looking down at their phones, almost bumping into each other.",
              "The same street in the morning, people walking with heads up, greeting each other, a vendor selling flowers."),
  'wedding': ("Guests at an Indian wedding all holding up phones to film, nobody actually watching or dancing.",
              "The same Indian wedding, guests dancing freely together, nobody holding a phone, marigold decorations."),
  'office':  ("A young professional at an office desk late at night, laptop open but scrolling a phone, tired eyes.",
              "The same young professional taking a walk in a green park at lunchtime, stretching, smiling at the sky."),
}

def job(sid):
    name, half = sid.rsplit('-', 1)
    night, day = SCENES[name]
    prompt = f"{STYLE} {NIGHT if half == 'night' else DAY} Scene: {night if half == 'night' else day}"
    body = json.dumps({"model": "gpt-image-2", "prompt": prompt, "size": "1536x1024", "quality": "medium", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        return sid, 'HTTP %s %s' % (e.code, e.read()[:300])
    open(os.path.join(OUT, sid + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return sid, 'ok'

def edit(sid):
    """day version = edit of the night image: same people, same place, phones gone, morning light."""
    name = sid.rsplit('-', 1)[0]
    src = os.path.join(OUT, name + '-night.png')
    prompt = (f"Redraw this exact scene with the SAME people, SAME place, SAME camera angle and composition, same illustration style. "
              f"{DAY} Change only this: {SCENES[name][1]}")
    bnd = '----pauzie' + os.urandom(6).hex()
    parts = []
    for k, v in (('model', 'gpt-image-2'), ('prompt', prompt), ('size', '1536x1024'), ('quality', 'medium')):
        parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="image[]"; filename="in.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
                 + open(src, 'rb').read() + b'\r\n')
    parts.append(f'--{bnd}--\r\n'.encode())
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=b''.join(parts),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={bnd}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        return sid, 'HTTP %s %s' % (e.code, e.read()[:300])
    open(os.path.join(OUT, sid + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    return sid, 'ok'

if sys.argv[1:2] == ['--edit']:
    with cf.ThreadPoolExecutor(5) as ex:
        for sid, st in ex.map(edit, sys.argv[2:]):
            print(sid, st, flush=True)
    sys.exit()

ids = sys.argv[1:] or [f'{k}-{h}' for k in SCENES for h in ('night', 'day')]
with cf.ThreadPoolExecutor(6) as ex:
    for sid, st in ex.map(job, ids):
        print(sid, st, flush=True)
