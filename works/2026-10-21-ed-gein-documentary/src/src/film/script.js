// The documentary, shot by shot, from Ed Gein's birth to his death. Every date and line comes from
// drafts/hold/true-crime-map/ed-gein-facts.md (its Wayback section wins where they differ) and keeps to its
// section 5: no remains, no farmhouse interior, no crime shown, the two women only as name cards.
//
// A shot: the scene it shows, how long it lasts, a slow camera move (`from` to `to`, each a position and a
// target in the scene's metres, with an optional portrait variant), and at most a large date, one line and a
// name card. `hits` are shot times that get a soft low hit in the sound; `sfx` lists the shot's sound effects.

import { LINE_LABELS, NAME_LABELS, PLACE_LABELS, labelCharacters } from './mapLabels.js'

export const SHOTS = [
  {
    scene: 'birth',
    score: 'opening',
    seconds: 4.4,
    date: '27 AUG 1906',
    line: 'Edward Gein is born in La Crosse County.',
    camera: {"ease":"linear","from":{"position":[-3.6,2.1,11.5],"target":[-1.6,1.5,1.5]},"to":{"position":[3.6,2.1,11.5],"target":[1.4,1.5,1.5]}},
    hits: [1.0],
  },
  {
    scene: 'map',
    seconds: 4,
    map: {"names":[["laCrosse",0.4],["plainfield",2.4]],"lines":[["move",0.5,2]],"marks":[["farm",2.4]]},
    camera: {"ease":"slow","from":{"position":[-150,364,25],"target":[-150,0,10]},"to":{"position":[-60,225,19],"target":[-60,0,10]}},
    portrait: {"ease":"slow","from":{"position":[-170,508,20],"target":[-170,0,0]},"to":{"position":[-40,293,12],"target":[-40,0,0]}},
    date: 'WAUSHARA COUNTY',
    line: 'The family moves to a farm near Plainfield.',
    hits: [2.5],
  },
  {
    scene: 'farmArrival',
    seconds: 2.6,
    sfx: [['wind', 0, 3.8, 0.6], ['steps_gravel', 0, 3.6, 0.8]],
    camera: {"ease":"out","from":{"position":[44,30,50],"target":[5,1,4]},"via":{"position":[30,6,36],"target":[5,1.4,5]},"to":{"position":[22,2.2,27],"target":[5,1.6,7]}},
  },
  {
    scene: 'schoolRoad',
    seconds: 3.0,
    sfx: [['wind', 0, 3.4, 0.6], ['steps_gravel', 0, 3.4, 0.8]],
    line: 'Ed grows up there with his older brother Henry.',
    camera: {"ease":"linear","duration":3.4,"from":{"position":[-11,1.4,6.8],"target":[-11,0.9,-1.5]},"to":{"position":[-5.1,1.4,6.8],"target":[-5.1,0.9,-1.5]}},
  },
  {
    scene: 'farm1940',
    score: 'deaths',
    seconds: 3.2,
    sfx: [['wind', 0, 3.4, 0.6], ['steps_gravel', 0, 2.8, 0.6]],
    date: '1 APR 1940',
    line: 'His father George dies of heart failure, age 66.',
    camera: {"from":{"position":[15.5,3,15.2],"target":[7,1.65,4.75]},"to":{"position":[15.5,3,15.2],"target":[7,1.65,4.75]}},
  },
  {
    // Plainfield Cemetery: a small graveside group, the hearse at the gate. Crane up.
    scene: 'burialGeorge',
    seconds: 3.6,
    sfx: [['wind', 0, 3.6, 0.45], ['bell', 0.3, 3.3, 0.5]],
    line: 'He is buried at Plainfield Cemetery.',
    camera: {"ease":"slow","from":{"position":[3.2,1.0,8.0],"target":[-0.8,0.9,0.4]},"to":{"position":[5.5,5.6,13.5],"target":[-1.4,0.5,0.6]}},
    portrait: {"ease":"slow","from":{"position":[2.2,1.1,9.2],"target":[-0.8,1.0,0.8]},"to":{"position":[4,6.4,15.5],"target":[-1.2,0.6,0.8]}},
  },
  {
    scene: 'brushFire',
    seconds: 3.4,
    sfx: [['wind', 0, 4.0, 0.7], ['fire', 0, 4.0, 0.45]],
    date: '16 MAY 1944',
    line: 'A brush fire on the farm gets out of control.',
    camera: {"ease":"slow","from":{"position":[17.7,1.8,16.1],"target":[41.3,-2,-51.7]},"to":{"position":[17.7,1.1,16.1],"target":[41.3,-2,-51.7]}},
    portrait: {"ease":"slow","from":{"position":[17.7,1.8,16.1],"target":[53.6,-2,-41.4]},"to":{"position":[17.7,1.1,16.1],"target":[53.6,-2,-41.4]}},
  },
  {
    // That night: the burnt marsh, embers and drifting smoke; no figure. A slow truck along it.
    scene: 'marshNight',
    seconds: 4.4,
    sfx: [['insects', 0, 4.4, 0.45], ['wind', 0, 4.4, 0.3]],
    line: 'Henry is found face down. The death is ruled asphyxiation, with no autopsy.',
    camera: {"ease":"linear","from":{"position":[-12,2.4,9],"target":[-7,0.2,-6]},"to":{"position":[3,2.4,9],"target":[8,0.2,-6]}},
  },
  {
    // A second headstone. Slow orbit.
    scene: 'burialHenry',
    seconds: 3.0,
    sfx: [['wind', 0, 3.0, 0.5], ['bell', 0.2, 2.8, 0.35]],
    line: 'Henry is buried there too.',
    camera: {"ease":"slow","orbit":{"center":[0.5,0.7,0],"radius":3.8,"height":[1.2,1.5],"angles":[64,104]}},
    portrait: {"ease":"slow","orbit":{"center":[0.45,0.8,0],"radius":6.2,"height":[1.3,1.6],"angles":[70,98]}},
  },
  {
    // Before her death: Ed carries firewood in and comes back out for more. Locked off.
    scene: 'caring',
    seconds: 4.6,
    sfx: [['wind', 0, 4.6, 1.0], ['steps_snow', 0.4, 2.65, 0.8], ['door', 2.2, 0.8, 0.6], ['clunk', 3.62, 0.4, 0.4], ['door', 3.75, 0.8, 0.5], ['steps_snow', 3.9, 2.6, 0.8], ['clunk', 5.2, 0.4, 0.3]],
    line: 'Augusta has several strokes. Ed cares for her.',
    camera: {"from":{"position":[17,2.6,17],"target":[2.5,2.0,2.5]},"to":{"position":[17,2.6,17],"target":[2.5,2.0,2.5]}},
    portrait: {"from":{"position":[14,2.6,20],"target":[2.0,2.2,2.5]},"to":{"position":[14,2.6,20],"target":[2.0,2.2,2.5]}},
  },
  {
    scene: 'winter',
    seconds: 3.6,
    sfx: [['wind', 0, 4.0, 1.2]],
    date: '29 DEC 1945',
    line: 'His mother Augusta dies after strokes, age 67.',
    camera: {"ease":"slow","from":{"position":[1.4,2.1,7.2],"target":[0.4,1.9,2.2]},"via":{"position":[8,3,18],"target":[1,2.2,0]},"to":{"position":[30,10,38],"target":[2,3,-4]}},
  },
  {
    // The third headstone, in snow. Tilt down from the bare trees.
    scene: 'burialAugusta',
    seconds: 3.4,
    sfx: [['wind', 0, 3.4, 0.8], ['bell', 0.2, 3.2, 0.45]],
    line: 'She is buried at Plainfield Cemetery.',
    camera: {"ease":"slow","from":{"position":[1.0,1.6,8.4],"target":[-3.7,6.8,-8]},"to":{"position":[1.0,1.6,8.4],"target":[-1.0,0.8,0]}},
    portrait: {"ease":"slow","from":{"position":[2.6,1.6,10],"target":[-1.0,3.4,-8]},"to":{"position":[2.6,1.6,10],"target":[0.6,0.9,0]}},
  },
  {
    // Section 5: one line only. Two windows go dark for good; one stays lit. A slow pan.
    scene: 'sealedRooms',
    seconds: 3.4,
    sfx: [['wind', 0, 3.4, 0.8], ['clock', 0, 3.4, 0.3]],
    line: "Ed seals off his mother's rooms and lives on alone.",
    camera: {"ease":"slow","from":{"position":[9,2.4,17],"target":[-6,3.4,2]},"to":{"position":[9,2.4,17],"target":[1.5,3.0,2]}},
    portrait: {"ease":"slow","from":{"position":[8,2.4,19],"target":[-4,3.6,2]},"to":{"position":[8,2.4,19],"target":[0,3.2,2]}},
  },
  {
    // Odd jobs in Plainfield (Oshkosh Northwestern, 18 Nov 1957). A truck past the house.
    scene: 'oddJobs',
    seconds: 4.2,
    sfx: [['wind', 0, 4.2, 0.5], ['shovel', 0, 4.2, 0.8], ['steps_snow', 0, 4.2, 0.3]],
    line: 'He does odd jobs around Plainfield: shovelling snow, mowing lawns.',
    fadeOut: 0.8,
    camera: {"ease":"linear","from":{"position":[-5,1.9,13],"target":[-2,0.55,2]},"to":{"position":[3,1.9,13],"target":[1.5,0.55,2]}},
    portrait: {"ease":"linear","from":{"position":[-3,1.9,13.5],"target":[-0.8,1.4,2]},"to":{"position":[2,1.9,13.5],"target":[0.8,1.4,2]}},
  },
  {
    scene: 'map',
    score: 'crimes',
    seconds: 3,
    map: {"names":[["plainfield",0.2,[0.6,0,1]]],"marks":[["farm",0.2],["pineGrove",0.5]],"lines":[["farmPineGrove",0.6,0.8]]},
    camera: {"ease":"slow","from":{"position":[-60,225,24],"target":[-60,0,15]},"to":{"position":[-48,225,-43],"target":[-48,0,-52]}},
    portrait: {"ease":"slow","from":{"position":[-62,323,28],"target":[-62,0,15]},"to":{"position":[-40,323,-27],"target":[-40,0,-40]}},
    hits: [0.8],
  },
  {
    scene: 'tavern',
    seconds: 4.2,
    sfx: [['wind', 0, 4.6, 0.9]],
    date: '8 DEC 1954',
    line: 'Mary Hogan disappears from her tavern.',
    card: { name: 'MARY HOGAN', detail: 'TAVERN KEEPER, 51', at: 1.3 },
    camera: {"ease":"out","from":{"position":[42,5.5,31],"target":[17,2.2,0]},"to":{"position":[15,5,29],"target":[-1,2,-2]}},
    portrait: {"ease":"out","from":{"position":[38,6.5,37],"target":[15,2.6,2]},"to":{"position":[12,6,32],"target":[-0.5,2.4,1]}},
    hits: [1.3],
  },
  {
    scene: 'tavernInterior',
    seconds: 5,
    sfx: [['neon', 0, 5, 0.4], ['crackle', 0, 5, 0.35], ['clock', 0, 5, 0.35], ['creak', 0.5, 0.8, 0.55], ['creak', 2.4, 0.8, 0.45]],
    line: 'The tavern is found empty. Investigators find a spent shell casing.',
    // A slow push in through the open door. Plates: [text, at, anchor, away].
    plates: [['SPENT SHELL CASING', 4.4, [1.2, 0.16, -7.4], [0, 1, 0]], ['TRAIL TO THE DOOR', 5.0, [0.5, 0.02, -5.5], [1, 0.8, 0]]],
    camera: { from: { position: [-0.85, 1.65, 1.0], target: [-0.3, 1.2, -6] }, to: { position: [-0.7, 1.5, -1.0], target: [0.3, 0.2, -6.6] } },
    portrait: { from: { position: [-0.85, 1.65, 1.2], target: [-0.2, 1.0, -6] }, to: { position: [-0.6, 1.5, -1.0], target: [0.4, 0.2, -6.6] } },
  },
  {
    scene: 'villageMorning',
    seconds: 3.0,
    sfx: [['wind', 0, 3.4, 0.7], ['engine_pass', 0, 3.4, 0.7], ['steps_snow', 0, 3.4, 0.35]],
    date: '16 NOV 1957',
    line: 'Deer season opens in Plainfield.',
    camera: {"ease":"out","from":{"position":[-56,50,110],"target":[10,0,40]},"to":{"position":[-52,19,106],"target":[11,5,42]}},
    portrait: {"ease":"out","from":{"position":[-42,48,100],"target":[10,0,44]},"to":{"position":[-40,19,98],"target":[11,5,44]}},
  },
  {
    scene: 'storeEvening',
    seconds: 4.4,
    sfx: [['wind', 0, 4.6, 0.7], ['steps_snow', 0, 1.5, 0.9], ['door', 1.55, 0.9, 0.9]],
    date: 'ABOUT 5 PM',
    line: 'Her son Frank, a deputy, finds her gone.',
    card: { name: 'BERNICE WORDEN', detail: 'HARDWARE STORE OWNER, 58', at: 2.1 },
    camera: {"ease":"slow","delay":1.8,"duration":1.8,"from":{"position":[1.5,1,62],"target":[12,1.7,46]},"to":{"position":[1.5,1,62],"target":[13,3.6,45]}},
    portrait: {"ease":"slow","delay":1.8,"duration":1.8,"from":{"position":[2,1,60],"target":[11,1.5,45]},"to":{"position":[2,1,60],"target":[12,3.6,44.5]}},
    hits: [2.1],
  },
  {
    scene: 'salesSlip',
    seconds: 3.6,
    sfx: [['paper', 0.2, 0.6, 0.6]],
    date: 'THAT EVENING',
    line: 'The last sales slip, for antifreeze, points to Ed Gein.',
    camera: {"ease":"slow","orbit":{"center":[13,2.8,44.5],"radius":11,"height":[3.4,3.1],"angles":[132,162]}},
  },
  {
    scene: 'map',
    score: 'arrest',
    seconds: 4,
    map: {"marks":[["store",0.2],["farm",0.2],["westPlainfield",1.8]],"lines":[["storeFarm",0.4,1.2]]},
    camera: {"ease":"inOut","delay":0.3,"duration":1.7,"from":{"position":[-30,199,22],"target":[-30,0,14]},"to":{"position":[-42,164,23],"target":[-42,0,16]}},
    portrait: {"ease":"inOut","delay":0.3,"duration":1.7,"from":{"position":[-14,446,33],"target":[-14,0,15]},"to":{"position":[-14,400,31],"target":[-14,0,15]}},
    hits: [2.6],
  },
  {
    scene: 'arrest',
    focus: { from: [6.6, 1.7, 9.1], to: [4.2, 1.2, 6.4], at: 1.0, duration: 1.2, range: 0.6, bokeh: 11 },
    seconds: 3.6,
    sfx: [['engine_idle', 0, 3.8, 0.6], ['siren', 0, 3.8, 0.25], ['car_door', 0.4, 0.4, 0.8], ['steps_gravel', 0.3, 2.7, 0.7]],
    date: 'THAT NIGHT',
    line: 'Ed Gein is arrested in West Plainfield.',
    camera: {"ease":"linear","from":{"position":[9.2,2,14.2],"target":[3.2,1.4,4.4]},"to":{"position":[8.9,1.95,13.8],"target":[3.6,1.4,4.8]}},
    hits: [0.9],
  },
  {
    scene: 'farmSearch',
    seconds: 3.0,
    sfx: [['generator', 0, 3.2, 0.8], ['clunk', 0.25, 0.4, 0.8], ['clunk', 0.65, 0.4, 0.8], ['clunk', 1.05, 0.4, 0.8], ['clunk', 1.45, 0.4, 0.8], ['steps_gravel', 0, 3.2, 0.5]],
    line: 'Deputies search the farm by flood lamp.',
    camera: {"ease":"linear","orbit":{"center":[2,2.8,-2],"radius":62,"height":[22,20],"angles":[62,40]}},
  },
  {
    scene: 'map',
    score: 'law',
    seconds: 2.6,
    map: {"names":[["plainfield",0.1]],"marks":[["farm",0,false],["westPlainfield",0,false],["wautoma",1.5]],"lines":[["storeWautoma",0.3,1.2]]},
    camera: {"ease":"slow","from":{"position":[30,260,60],"target":[30,0,50]},"to":{"position":[85,234,114],"target":[85,0,105]}},
    portrait: {"ease":"slow","from":{"position":[30,431,27],"target":[30,0,10]},"to":{"position":[62,431,52],"target":[62,0,35]}},
    hits: [1.5],
  },
  {
    // 17 Nov 1957: a small interview room (the real jail building is not known). Crane up from table height.
    scene: 'jailRoom',
    seconds: 4.4,
    sfx: [['hum', 0, 4.4, 0.3], ['clock', 0, 4.4, 0.4], ['door', 0.2, 0.8, 0.4], ['clunk', 0.9, 0.4, 0.35]],
    date: '17 NOV 1957',
    line: 'He is held and questioned at the Waushara County Jail in Wautoma.',
    camera: {"ease":"slow","from":{"position":[2.7,1.3,2.7],"target":[0,0.35,0]},"to":{"position":[2.7,2.4,2.7],"target":[0,0.25,0]}},
    portrait: {"ease":"slow","from":{"position":[2.7,1.3,2.7],"target":[0,0.5,0]},"to":{"position":[2.7,2.4,2.7],"target":[0,0.4,0]}},
  },
  {
    scene: 'courthouse',
    seconds: 3.6,
    sfx: [['wind', 0, 3.8, 0.6], ['steps_gravel', 0, 3.4, 0.7]],
    date: '21 NOV 1957',
    line: 'Arraigned in Wautoma, he pleads not guilty by reason of insanity.',
    camera: {"ease":"slow","delay":2.4,"duration":4.4,"from":{"position":[9,1.4,25],"target":[-8,0.6,9]},"to":{"position":[9,1.4,25],"target":[-7,2.0,4]}},
    portrait: {"ease":"slow","delay":2.4,"duration":4.4,"from":{"position":[9,1.4,25],"target":[1,0.6,9]},"to":{"position":[9,1.4,25],"target":[0,1.4,4]}},
  },
  {
    // Waushara County Court: a truck along the rail, past the defence table, the bench and the empty jury box.
    scene: 'courtroom1957',
    seconds: 4.4,
    sfx: [['clock', 0, 4.4, 0.45], ['gavel', 0.9, 0.6, 0.7], ['creak', 2.6, 0.8, 0.3]],
    line: 'In Waushara County Court he faces one count of first-degree murder.',
    camera: {"ease":"linear","from":{"position":[-4.0,2.3,4.9],"target":[-1.6,1.1,-3.2]},"to":{"position":[-0.4,2.3,4.9],"target":[0.6,1.1,-3.2]}},
    portrait: {"ease":"linear","from":{"position":[-3.6,2.3,4.9],"target":[-2.2,1.1,-3.2]},"to":{"position":[-1.0,2.3,4.9],"target":[0.2,1.1,-3.2]}},
  },
  {
    scene: 'map',
    seconds: 3,
    map: {"names":[["plainfield",0]],"marks":[["farm",0,false],["wautoma",0,false]],"lines":[["storeWautoma",0,0],["toWaupun",0.4,1.0]]},
    camera: {"ease":"out","from":{"position":[70,286,111],"target":[70,0,100]},"to":{"position":[85,260,160],"target":[85,0,150]}},
    portrait: {"ease":"out","from":{"position":[70,416,57],"target":[70,0,40]},"to":{"position":[100,385,85],"target":[100,0,70]}},
    hits: [1.7],
  },
  {
    scene: 'hospital',
    seconds: 3.4,
    sfx: [['wind', 0, 3.6, 0.7]],
    line: 'Found unfit for trial, he is committed to Central State Hospital.',
    camera: {"ease":"linear","from":{"position":[-14,6.5,34],"target":[-5,6,0]},"to":{"position":[8,6.5,34],"target":[4,6,0]}},
  },
  {
    // Central State Hospital, Waupun: a plain ward. A pan from the barred windows and the door to a man on his bed.
    scene: 'ward',
    seconds: 4.4,
    sfx: [['clock', 0, 4.4, 0.3], ['clunk', 0.6, 0.4, 0.3]],
    date: 'DEC 1957 / JAN 1958',
    line: 'Central State Hospital, Waupun.',
    camera: {"ease":"slow","from":{"position":[2.0,1.5,4.9],"target":[-3.1,0.95,3.0]},"to":{"position":[2.0,1.5,4.9],"target":[1.0,1.6,-3]}},
    portrait: {"ease":"slow","from":{"position":[2.0,1.5,4.9],"target":[-3.1,0.95,2.4]},"to":{"position":[2.0,1.5,4.9],"target":[-0.6,1.6,-3]}},
  },
  {
    scene: 'fire',
    seconds: 3.6,
    sfx: [['fire', 0, 4.2, 1.0], ['wind', 0, 4.2, 0.6]],
    date: '20 MAR 1958',
    line: 'The farmhouse burns, ten days before the auction.',
    camera: {"ease":"linear","from":{"position":[55,12,72],"target":[0,5,-5]},"to":{"position":[60,13,78.5],"target":[0,5,-5]}},
    hits: [0.8],
  },
  {
    scene: 'trial',
    seconds: 3.8,
    sfx: [['gavel', 0.6, 0.6, 0.9], ['steps_gravel', 0, 4.2, 0.55]],
    date: '7 NOV 1968',
    line: "Tried for Bernice Worden's murder, with no jury, before Judge Robert H. Gollmar.",
    camera: {"ease":"slow","from":{"position":[-9,0.7,23],"target":[1,3.2,9]},"to":{"position":[-9,3.6,23],"target":[1,2.6,10]}},
    portrait: {"ease":"slow","from":{"position":[-8,0.7,24],"target":[1.8,2.6,9.5]},"to":{"position":[-8,3.4,24],"target":[2,2,11]}},
  },
  {
    // 14 Nov 1968: the judge's bench trial. The jury box stays empty. Focus is held across the well so judge, Ed and deputy stay sharp.
    scene: 'courtroom1968',
    focus: { from: [-1.5, 1.0, -3.5], to: [-1.5, 1.0, -3.5], at: 0, duration: 1, range: 7, bokeh: 3 },
    seconds: 4.8,
    sfx: [['clock', 0, 5.0, 0.45], ['gavel', 3.4, 0.6, 0.9], ['creak', 1.0, 0.8, 0.3]],
    date: '14 NOV 1968',
    line: "Guilty of first-degree murder for Bernice Worden, then not guilty by reason of insanity.",
    camera: {"ease":"slow","from":{"position":[-3.9,2.0,4.9],"target":[-0.4,1.1,-3]},"to":{"position":[-3.9,3.7,4.9],"target":[0.6,0.8,-2.6]}},
    portrait: {"ease":"slow","from":{"position":[-3.2,2.2,4.9],"target":[-2.4,1.1,-3]},"to":{"position":[-3.2,3.9,4.9],"target":[-1.8,0.7,-2.8]}},
  },
  {
    scene: 'map',
    seconds: 2.8,
    map: {"names":[["plainfield",0]],"marks":[["farm",0,false],["wautoma",0,false]],"lines":[["storeWautoma",0,0],["toWaupun",0,0,false],["toMadison",0.3,1.0]]},
    camera: {"ease":"slow","from":{"position":[95,277,151],"target":[95,0,140]},"to":{"position":[75,260,185],"target":[75,0,175]}},
    portrait: {"ease":"slow","from":{"position":[90,416,77],"target":[90,0,60]},"to":{"position":[80,385,90],"target":[80,0,75]}},
    fadeOut: 0.8,
    hits: [1.5],
  },
  {
    scene: 'corridor',
    seconds: 4.6,
    sfx: [['hum', 0, 5.0, 0.6], ['clock', 0, 5.0, 0.6]],
    date: '26 JUL 1984',
    line: 'He dies at Mendota Mental Health Institute, age 77.',
    camera: {"ease":"slow","from":{"position":[0.5,1.55,-8.5],"target":[-0.8,1.3,-14]},"to":{"position":[0.6,1.6,2.5],"target":[-0.6,1.3,-14]}},
    hits: [1.0],
  },
  {
    scene: 'map',
    score: 'ending',
    seconds: 4.6,
    fadeOut: 1.4,
    map: {"names":[["plainfield",0]],"marks":[["farm",0,false],["pineGrove",0,false],["westPlainfield",0,false],["wautoma",0,false]],"lines":[["storeFarm",0,0],["storeWautoma",0,0],["toWaupun",0,0,false],["toMadison",0,0,false]]},
    camera: {"ease":"inOut","from":{"position":[-40,242,-10],"target":[-40,0,-20]},"to":{"position":[55,485,89],"target":[55,0,70]}},
    portrait: {"ease":"inOut","from":{"position":[-40,262,-10],"target":[-40,0,-20]},"to":{"position":[50,508,65],"target":[50,0,45]}},
    names: ['Mary Hogan, 1954.', 'Bernice Worden, 1957.'],
    hits: [0.6],
  },
]

// Pacing, LEMMiNO style: hard cuts between shots and only three dips to black (after 1945, before 1984 and the
// end). Text fades in and out over TEXT_FADE, and every piece of text stays fully readable for at least
// 1.2 s + 0.07 s per character, counted from the moment it is fully in. A shot grows until all its text fits.
export const TEXT_FADE = 0.3
export const DATE_DELAY = 0.1
export const LINE_DELAY = 0.3
const MIN_SHOT = 2.4
const END_MARGIN = 0.05
export const readingHold = (characters) => 1.2 + 0.07 * characters

// Every piece of text in a shot: when it starts fading in, when it must be gone, and how many characters it has.
export function textItems(shot) {
  const items = []
  const fadeIn = shot.fadeIn
  const hardEnd = shot.seconds - (shot.fadeOut ?? 0) - END_MARGIN
  if (shot.date || shot.line) {
    // The date and the line are read together, counted from the line being fully in.
    const characters = (shot.date ?? '').length + (shot.line ?? '').length
    items.push({ kind: 'caption', in: fadeIn + (shot.line ? LINE_DELAY : DATE_DELAY), end: hardEnd, characters })
  }
  if (shot.card) items.push({ kind: 'card', in: fadeIn + shot.card.at, end: hardEnd, characters: shot.card.name.length + shot.card.detail.length })
  ;(shot.names ?? []).forEach((name, index) => items.push({ kind: 'name', in: 0.3 + index * 0.7, end: shot.seconds - END_MARGIN, characters: name.length }))
  for (const [name, at] of shot.plates ?? []) items.push({ kind: 'plate', in: at, end: hardEnd, characters: name.length })
  const map = shot.map
  if (map) {
    for (const [id, at, labelled = true] of map.marks ?? []) {
      if (labelled && PLACE_LABELS[id]) items.push({ kind: 'map', in: at + 0.15, end: hardEnd, characters: labelCharacters(PLACE_LABELS[id]) })
    }
    for (const [id, at] of map.names ?? []) items.push({ kind: 'map', in: at, end: hardEnd, characters: labelCharacters(NAME_LABELS[id]) })
    for (const [id, start, duration, labelled = true] of map.lines ?? []) {
      const label = LINE_LABELS[id]
      if (label && labelled && (duration > 0 || label.sub)) items.push({ kind: 'map', in: start + duration + 0.1, end: hardEnd, characters: labelCharacters(label) })
    }
  }
  return items
}

// Map sound design, derived from each map shot's animation so it stays in sync: a pen scratch while each red line
// draws (tools/sfx.py follows the line's easing), a muted thump as each red X or ring lights, a tick as each plate
// appears, and a low swell on pull-outs. Marks, names and lines already on at the cut make no sound.
const PLATE_TICK = ['map_tick', 0.12, 0.35]
function mapCues(shot) {
  const map = shot.map
  const cues = []
  for (const [id, start, duration, labelled = true] of map.lines ?? []) {
    if (duration <= 0) continue
    cues.push(['map_draw', start, duration, 0.55])
    if (labelled && LINE_LABELS[id]) cues.push([PLATE_TICK[0], start + duration + 0.1, PLATE_TICK[1], PLATE_TICK[2]])
  }
  for (const [id, at, labelled = true] of map.marks ?? []) {
    if (at <= 0) continue
    cues.push(['map_mark', at, 1.0, 0.6])
    if (labelled && PLACE_LABELS[id]) cues.push([PLATE_TICK[0], at + 0.15, PLATE_TICK[1], PLATE_TICK[2]])
  }
  for (const [, at] of map.names ?? []) if (at > 0) cues.push([PLATE_TICK[0], at, PLATE_TICK[1], PLATE_TICK[2]])
  const move = shot.camera
  if (move.to && move.to.position[1] > move.from.position[1] * 1.3) cues.push(['map_swell', move.delay ?? 0, move.duration ?? shot.seconds, 0.5])
  return cues
}
SHOTS.forEach((shot) => { if (shot.map) shot.sfx = [...(shot.sfx ?? []), ...mapCues(shot)] })

// Start time of every shot, the dip it rises from, its length after the reading rule, and the whole length.
let elapsed = 0
SHOTS.forEach((shot, index) => {
  shot.fadeIn = index > 0 ? (SHOTS[index - 1].fadeOut ?? 0) : 0
  shot.writtenSeconds = shot.seconds
  for (const item of textItems(shot)) {
    const slack = shot.writtenSeconds - item.end
    const needed = item.in + TEXT_FADE + readingHold(item.characters) + TEXT_FADE + slack
    shot.seconds = Math.max(shot.seconds, Math.ceil(needed * 10) / 10)
  }
  shot.seconds = Math.max(shot.seconds, MIN_SHOT)
  shot.start = elapsed
  elapsed += shot.seconds
})
export const DURATION = elapsed

// Ambience runs to the end of the stretched shot; footsteps keep their written length, matched to the walking.
const stretchCue = (shot, kind, at, duration) => (!kind.startsWith('steps') && !kind.startsWith('map_') && at + duration >= shot.writtenSeconds - 0.05 ? shot.seconds - at : duration)

// Sound effects in film seconds: { kind, start, duration, gain }. A steps cue only names the surface and the loudness
// for the window; tools/sfx.py puts one recorded step on every footfall the figures make in it.
export const SFX_CUES = SHOTS.flatMap((shot) => (shot.sfx ?? []).map(([kind, at, duration, gain]) => ({ kind, start: shot.start + at, duration: Math.min(stretchCue(shot, kind, at, duration), shot.seconds - at), gain })))
SHOTS.forEach((shot) => { shot.items = textItems(shot) })

// Where each section of the score starts (tools/music.py): the first cut of its first shot.
export const SCORE_SECTIONS = SHOTS.filter((shot) => shot.score).map((shot) => ({ name: shot.score, start: shot.start }))

export const HITS = SHOTS.flatMap((shot) => (shot.hits ?? []).map((time) => shot.start + time))

export function shotIndexAt(seconds) {
  for (let index = SHOTS.length - 1; index >= 0; index--) if (seconds >= SHOTS[index].start) return index
  return 0
}
