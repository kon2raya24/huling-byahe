// Nights, ghosts and the logbook. Pure data plus small helpers; no DOM.
// Events are placed at a fraction `at` of the route. kinds:
//   pickup  - a PARA stop where the ghost boards
//   dropoff - a PARA stop where the ghost gets off (only appears if they are aboard)
//   line    - spoken while the ghost is aboard (tatay is aboard every night)
// `frag` marks a logbook fragment; lines without one are flavour.

export const GHOSTS = {
  lola: { name: 'Lola Caring', color: '#f6c177' },
  mika: { name: 'Mika', color: '#9ccfd8' },
  ben: { name: 'Kuya Ben', color: '#eb6f92' },
  totoy: { name: 'Totoy', color: '#c4a7e7' },
  tatay: { name: 'The Silent Passenger', trueName: 'Tatay Ernesto', color: '#e0def4' },
};

export const NIGHTS = [
  {
    n: 1, title: 'Unang Byahe', subtitle: 'First trip',
    events: [
      { at: 0.02, kind: 'line', ghost: 'tatay', frag: 'tatay-1', text: 'A man in a faded cap is already sitting at the back when you start the engine. He doesn\'t say a word.' },
      { at: 0.22, kind: 'pickup', ghost: 'lola', frag: 'lola-1', text: 'Para, iho! My apo is waiting at Tayuman. I brought him ensaymada.' },
      { at: 0.42, kind: 'line', ghost: 'lola', text: 'He likes the one with extra cheese.' },
      { at: 0.6, kind: 'line', ghost: 'lola', text: 'Every Sunday he waits for me by the gate.' },
      { at: 0.8, kind: 'dropoff', ghost: 'lola', frag: 'lola-2', text: 'Salamat, iho. Keep the change. Ay, I only have old coins.' },
    ],
  },
  {
    n: 2, title: 'Ulan', subtitle: 'Rain',
    events: [
      { at: 0.15, kind: 'pickup', ghost: 'mika', frag: 'mika-1', text: 'Para po! Sixteen-hour shift. Can I close my eyes until Sampaloc?' },
      { at: 0.3, kind: 'line', ghost: 'mika', text: 'Twelve patients tonight. I remembered all their names.' },
      { at: 0.42, kind: 'pickup', ghost: 'lola', frag: 'lola-3', text: 'Iho, again? He wasn\'t at the gate. Maybe they moved.' },
      { at: 0.65, kind: 'dropoff', ghost: 'mika', frag: 'mika-2', text: 'My mother keeps the porch light on. I can always see it from the corner.' },
      { at: 0.9, kind: 'dropoff', ghost: 'lola', frag: 'lola-4', text: 'Tayuman looks different now. Taller. Everything is taller.' },
    ],
  },
  {
    n: 3, title: 'Barker', subtitle: 'Cubao! Cubao!',
    events: [
      { at: 0.12, kind: 'pickup', ghost: 'ben', frag: 'ben-1', text: 'Cubao! Cubao! Ay, sorry, habit. Thirty years calling passengers and I never once sat down.' },
      { at: 0.28, kind: 'line', ghost: 'ben', text: 'The seat is softer than I thought.' },
      { at: 0.45, kind: 'pickup', ghost: 'mika', frag: 'mika-3', text: 'The porch light was off tonight. That has never happened.' },
      { at: 0.6, kind: 'dropoff', ghost: 'ben', frag: 'ben-2', text: 'Tell the new barkers: always smile. People remember a smile.' },
      { at: 0.88, kind: 'dropoff', ghost: 'mika', frag: 'mika-4', text: 'Maybe she finally went to sleep. Good. She should rest.' },
    ],
  },
  {
    n: 4, title: 'Aso', subtitle: 'The dog',
    events: [
      { at: 0.18, kind: 'pickup', ghost: 'totoy', frag: 'totoy-1', text: 'Kuya, have you seen a brown dog? His name is Bantay. He chases jeepneys.' },
      { at: 0.3, kind: 'line', ghost: 'totoy', text: 'He has one white ear. You can\'t miss it.' },
      { at: 0.4, kind: 'pickup', ghost: 'ben', frag: 'ben-3', text: 'One more ride, boss. I want to see Cubao from a window seat.' },
      { at: 0.62, kind: 'dropoff', ghost: 'totoy', frag: 'totoy-2', text: 'He\'s not here. I\'ll look again tomorrow night.' },
      { at: 0.86, kind: 'dropoff', ghost: 'ben', frag: 'ben-4', text: 'So that\'s what it looks like from inside. Salamat, boss. Lakad na.' },
    ],
  },
  {
    n: 5, title: 'Pasalubong', subtitle: 'Gifts from home',
    events: [
      { at: 0.15, kind: 'pickup', ghost: 'lola', frag: 'lola-5', text: 'I found him, iho. A tall man now, with a little one of his own.' },
      { at: 0.3, kind: 'line', ghost: 'lola', text: 'I gave the ensaymada to the little one instead.' },
      { at: 0.38, kind: 'line', ghost: 'tatay', frag: 'tatay-2', text: 'The man at the back hums along to the radio. You know the song. Your father used to hum it.' },
      { at: 0.46, kind: 'pickup', ghost: 'totoy', frag: 'totoy-3', text: 'Kuya! I heard barking near the church!' },
      { at: 0.62, kind: 'dropoff', ghost: 'lola', frag: 'lola-6', text: 'That is enough for me. I can go home now. Ingat, iho.' },
      { at: 0.9, kind: 'dropoff', ghost: 'totoy', frag: 'totoy-4', text: 'Almost. He\'s close. I can feel it.' },
    ],
  },
  {
    n: 6, title: 'Bantay', subtitle: 'The one who waits',
    events: [
      { at: 0.12, kind: 'pickup', ghost: 'mika', frag: 'mika-5', text: 'The porch light is on again. I think she\'s okay now.' },
      { at: 0.3, kind: 'pickup', ghost: 'totoy', frag: 'totoy-5', text: 'Tonight, Kuya. Tonight I find him.' },
      { at: 0.4, kind: 'line', ghost: 'tatay', frag: 'tatay-3', text: 'The man at the back is watching the road. His lips move, but no sound comes out.' },
      { at: 0.56, kind: 'dropoff', ghost: 'totoy', frag: 'totoy-6', bantay: true, text: 'BANTAY! You waited for me! Good boy. Good boy.' },
      { at: 0.78, kind: 'dropoff', ghost: 'mika', frag: 'mika-6', text: 'Thank you for always stopping for me. Not everyone does.' },
    ],
  },
  {
    n: 7, title: 'Huling Byahe', subtitle: 'The last trip',
    events: [
      { at: 0.25, kind: 'line', ghost: 'tatay', frag: 'tatay-4', text: 'Anak.' },
      { at: 0.45, kind: 'line', ghost: 'tatay', frag: 'tatay-5', text: 'You brake too early. Just like I taught you.' },
      { at: 0.65, kind: 'line', ghost: 'tatay', frag: 'tatay-6', text: 'Thirty years on this route. I never finished the last one.' },
      { at: 0.93, kind: 'dropoff', ghost: 'tatay', frag: 'tatay-7', final: true, text: 'Ito na ang huling byahe ko. Salamat, anak. Ingat sa pag-uwi.' },
    ],
  },
];

export const FRAGMENTS = NIGHTS.flatMap((night) => night.events.filter((e) => e.frag).map((e) => ({ id: e.frag, ghost: e.ghost, night: night.n, text: e.text })));

export const nightByNumber = (n) => NIGHTS.find((night) => night.n === n);

// Logbook: every ghost with its fragments in story order, earned or not.
export function logbook(earned) {
  const have = new Set(earned);
  return Object.entries(GHOSTS).map(([id, g]) => {
    const frags = FRAGMENTS.filter((f) => f.ghost === id).map((f) => ({ ...f, earned: have.has(f.id) }));
    const revealed = id !== 'tatay' || have.has('tatay-7');
    return { id, name: revealed && g.trueName ? g.trueName : g.name, color: g.color, frags, complete: frags.every((f) => f.earned) };
  });
}

export const endingUnlocked = (earned) => new Set(earned).has('tatay-7');
