// Tiny pixel icons drawn from text bitmaps, so the HUD and the end screens need no image files.
const PALETTE = {
  k: '#2a1a14', w: '#fff3d6', r: '#c0303f', d: '#8a1828', p: '#f0b8a8', y: '#e8b830', b: '#a8703c',
  g: '#bdbdb5', o: '#e07a30', c: '#f2e6c4', n: '#5a3a24', s: '#d9a07a',
};

const BITMAPS = {
  worm: ['..........', '..dddd....', '.drrrrd...', '.drkrrd...', '..dddrrd..', '.....drrd.', '..ddddrrd.', '.drrrrrd..', '..dddddd..'],
  chicken: ['....rr....', '...cccc...', '..cckcyy..', '..ccccy...', '.cccccc...', '.cccccc...', '..cccc....', '...y.y....'],
  rabbit: ['..pp..pp..', '..pc..cp..', '..cccccc..', '.ccckcckc.', '.cccccccc.', '..cccccc..', '.cccccccc.', '.cc....cc.'],
  pig: ['..p....p..', '.pppppppp.', 'pppkppkppp', 'pppppppppp', 'ppnppppnpp', 'ppppnnpppp', '.pppppppp.', '..pp..pp..'],
  deer: ['n.n..n.n..', '.nn..nn...', '..bbbbb...', '.bbkbbkb..', '.bbbbbbb..', '..bbbbbb..', '.bbbbbbbb.', '.bb.bb.bb.'],
  cow: ['k..kkkk..k', 'wwwkkkkwww', 'wwkwwwwkww', 'wkkwwwwkkw', 'wwwwppppww', 'wwwwpkkpww', '.wwwwwwww.', '..ww..ww..'],
  villager: ['..nnnn....', '.nnnnnn...', '.sskssks..', '.ssssss...', '..oooooo..', '.soooooos.', '..oooooo..', '..nn..nn..'],
  skull: ['..wwwwww..', '.wwwwwwww.', 'wwkkwwkkww', 'wwkkwwkkww', 'wwwwkkwwww', '.wwwwwwww.', '..wkwkwk..', '..wwwwww..'],
  star: ['....yy....', '....yy....', '...yyyy...', 'yyyyyyyyyy', '.yyyyyyyy.', '..yyyyyy..', '..yyyyyy..', '.yyy..yyy.', '.yy....yy.'],
  clock: ['..wwwwww..', '.wwwwwwww.', 'wwwwkwwwww', 'wwwwkwwwww', 'wwwwkkkwww', 'wwwwwwwwww', '.wwwwwwww.', '..wwwwww..'],
  soundOn: ['....w.....', '...ww..w..', 'www.w.w.w.', 'www.w..w.w', 'www.w.w.w.', '...ww..w..', '....w.....'],
  soundOff: ['....w.....', '...ww.w.w.', 'www.w..w..', 'www.w.w.w.', 'www.w.....', '...ww.....', '....w.....'],
};

const cache = new Map();

// Returns a data URL for the named bitmap, one pixel per character; callers scale it with image-rendering: pixelated.
export function iconUrl(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = BITMAPS[name];
  const width = Math.max(...rows.map((row) => row.length));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rows.length;
  const context = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
    }
  });
  const url = canvas.toDataURL();
  cache.set(name, url);
  return url;
}

export function iconElement(name, label = '') {
  const image = document.createElement('img');
  image.src = iconUrl(name);
  image.className = 'icon';
  image.alt = label;
  image.draggable = false;
  return image;
}
