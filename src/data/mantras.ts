/** Short, original thoughts for the round. One is picked per day. */
export const MANTRAS = [
  'Pick a small target, commit, and let it go. The last shot is already history.',
  'Smooth is long. Swing at eighty per cent and let the club do the work.',
  'Play the shot in front of you, not the score in your head.',
  'Middle of the green is never a bad result.',
  'Bogey is not a disaster. A double from chasing par is.',
  'Breathe out before you take it back.',
  'Trust the club you chose. Doubt costs more yards than wind.',
  'Every putt is straight once you have picked the line.',
  'Hit it, find it, hit it again. Keep it that simple.',
  'Tempo first. Power follows.',
  'Take your medicine from the trees. One shot back to the fairway.',
  'You only need to beat the hole you are on.',
  'Walk slowly between shots. Rush nothing today.',
  'See the ball land before you swing.',
  'Good golf is mostly avoiding big numbers.',
  'Commit to the read and hit it firm enough to finish past the hole.',
  'The best recovery is a calm next shot.',
  'Aim small, miss small.',
  'Same routine on every shot, from the first tee to the last putt.',
  'Lag it close and let the second putt be easy.',
  'Swing your swing, not the one from the video.',
  'Enjoy the walk. The score looks after itself when you do.',
  'One more club and a smooth swing beats a hard swing every time.',
  'Short game wins money games.',
  'If in doubt, play to the fat side of the green.',
  'Reset on every tee box. New hole, clean card.',
  'Feel the weight of the putter head and let it swing.',
  'Finish your swing and hold the pose.',
  'Good decisions before good shots.',
  'Have fun with your mates. Nobody remembers the three-putts.',
]

export function mantraFor(date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000)
  return MANTRAS[day % MANTRAS.length]
}
