import type { GameType } from '../engine/types'

export interface GameRules {
  /** One line on what the game is. */
  summary: string
  /** How a hole and the game are won, in order. */
  howItWorks: string[]
  handicaps: string
  /** What happens if a player can't finish a hole. */
  pickUp: string
  money: string
}

/**
 * Plain-English rules for each game, written to match how the app scores it.
 * Checked against England Golf, Golf Monthly, Golf Digest, National Club Golfer and the USGA Rules of Handicapping, November 2026.
 */
export const GAME_RULES: Record<GameType, GameRules> = {
  stroke: {
    summary: 'Count every shot. The lowest total net score over the round wins.',
    howItWorks: [
      'Each player plays their own ball and holes out on every hole.',
      'Your net score is your total strokes minus your playing handicap.',
      'Lowest net total wins. The leaderboard shows net score against par as you go.',
    ],
    handicaps: 'Full playing handicap (100%) by default, worked out from your Handicap Index and tees.',
    pickUp: 'Every hole needs a score. If you pick up, your card shows NR (no return) and you drop out of the stroke play result, though you stay in the other games.',
    money: 'Paid per stroke. Each player settles with each other player on the difference between their net totals, once every card is complete.',
  },
  stableford: {
    summary: 'Score points on each hole against your net par. Most points wins.',
    howItWorks: [
      'Your handicap gives you shots on the hardest holes, by stroke index.',
      'Points per hole on your net score: net double bogey or worse 0, net bogey 1, net par 2, net birdie 3, net eagle 4, net albatross 5.',
      'Add up the points over 18 holes. Highest total wins. 36 points is playing to your handicap.',
    ],
    handicaps: 'Full playing handicap (100%) by default.',
    pickUp: "Once you can't score a point on a hole, pick up and tap your score until it shows P/U. You get 0 points for that hole and carry on.",
    money: 'Paid per point. Each player settles with each other player on the difference in points.',
  },
  match: {
    summary: 'Two players go head to head, hole by hole.',
    howItWorks: [
      'Lower net score wins the hole. Equal scores halve it.',
      'The score is kept in holes: "2 up" means you have won two more holes than your opponent.',
      'The match ends when one player is more holes up than there are holes left, for example "3 & 2".',
    ],
    handicaps: 'The lower handicap plays off scratch and the other player gets the difference, taken on the hardest holes by stroke index.',
    pickUp: 'Picking up loses the hole, unless both players pick up, which halves it.',
    money: 'The winner collects the stake. A halved match pays nothing.',
  },
  nassau: {
    summary: 'Three match play bets in one: the front 9, the back 9 and the full 18.',
    howItWorks: [
      'Two players play match play, hole by hole, on net scores.',
      'The front 9, back 9 and overall are separate bets, each won by whoever is up at the end of it.',
      'You can lose the front 9 and still win the back 9 and the overall.',
    ],
    handicaps: 'As in match play: the lower handicap plays off scratch and the other gets the difference.',
    pickUp: 'Picking up loses the hole for every bet it counts towards.',
    money: 'The stake is paid on each of the three bets, so up to three stakes change hands.',
  },
  betterBall: {
    summary: 'Pairs play together and the better score of the two counts on each hole.',
    howItWorks: [
      'Within each group, players 1 and 2 play against players 3 and 4.',
      'Each of you plays your own ball. On every hole, the better net result of the pair is the team score.',
      'Play it as Stableford (best points on each hole, highest team total wins) or as match play between the two pairs.',
    ],
    handicaps: "85% of each player's playing handicap, the standard allowance for four-ball.",
    pickUp: 'You can pick up whenever your partner is doing better on the hole. Only one of you needs a score.',
    money: 'Stableford: per point of difference between teams. Match play: the winning pair collects the stake from the losing pair.',
  },
  skins: {
    summary: 'Every hole is worth a skin. Win the hole outright to take it.',
    howItWorks: [
      'The lowest net score on a hole wins the skin, but only if nobody ties it.',
      'If two or more players tie for the lowest score, the skin carries over and the next hole is worth two, and so on.',
      'The player with the most skins at the end has won the most money.',
    ],
    handicaps: 'Full playing handicap (100%) by default.',
    pickUp: "A pick-up can't win a skin. If everyone picks up, the skin carries over.",
    money: 'Each skin is worth the stake. Players settle on the difference in skins won.',
  },
  scramble: {
    summary: 'A team game where everyone hits, and you play the best shot each time.',
    howItWorks: [
      'Everyone in the team tees off. The team picks the best drive and everyone plays their next shot from there.',
      'Keep picking the best shot until the ball is holed. The team records one score per hole.',
      'Each group in the round is one team. Lowest net team total wins.',
    ],
    handicaps: 'Team handicap from course handicaps, lowest first: 25%, 20%, 15% and 10% for a team of four; 30%, 20% and 10% for three; 35% and 15% for two.',
    pickUp: 'Leave the team score blank for a hole you did not finish. It will not count towards the total.',
    money: 'Each player wins the stake for every team theirs beats and pays it for every team that beats them, once all teams finish.',
  },
  sixPoint: {
    summary: 'A three-player game where six points are shared out on every hole.',
    howItWorks: [
      'Lowest net score gets 4 points, second gets 2, third gets 0.',
      'Ties split the points: two tied for best get 3 each, two tied for second get 1 each, and a three-way tie is 2 each.',
      'Win a hole by two shots or more and you take all 6 points.',
    ],
    handicaps: 'Full playing handicap (100%) by default.',
    pickUp: 'A pick-up counts as the worst score on the hole.',
    money: 'Paid per point. Each player settles with each other player on the difference in points.',
  },
  wolf: {
    summary: 'A four-player game where the Wolf picks a partner, or goes it alone, on every hole.',
    howItWorks: [
      'The Wolf rotates each hole. After watching the others tee off, the Wolf picks one of them as a partner or plays as Lone Wolf.',
      'With a partner: the pair with the better net ball wins the hole, and each winner gets 1 point.',
      'Lone Wolf: beat all three on your own for 4 points. Lose and each of the other three gets 1 point.',
      'On 17 and 18 the player in last place is the Wolf, to give them a chance to catch up.',
    ],
    handicaps: 'Full playing handicap (100%) by default.',
    pickUp: 'A pick-up counts as the worst score on the hole.',
    money: 'Paid per point. Each player settles with each other player on the difference in points.',
  },
  snake: {
    summary: 'A putting side game. Whoever three-putts last pays everyone.',
    howItWorks: [
      'The first player to three-putt takes the snake.',
      'Each time someone else three-putts, the snake passes to them.',
      'Whoever holds the snake after the last hole pays every other player.',
    ],
    handicaps: 'No handicaps. It is all about putts.',
    pickUp: 'Only putts count. Each player logs their own putts on the hole screen.',
    money: 'The holder pays the stake to each other player. You can add an amount for every three-putt, so the snake grows as the round goes on.',
  },
}

export const GAME_RULE_SOURCES: [string, string][] = [
  ['England Golf: What is Stableford scoring?', 'https://englandigolf.co.uk/igolf-blog/what-is-stableford-scoring/'],
  ['Golf Monthly: What is Stableford in golf?', 'https://www.golfmonthly.com/features/the-game/stableford-explained-77797'],
  ['Golf Monthly: How does four-ball better-ball work?', 'https://www.golfmonthly.com/features/the-game/what-is-four-balls-in-golf-245076'],
  ['USGA: Appendix C, handicap allowances', 'https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Appendix C Handicap Allowances.htm'],
  ['National Club Golfer: Texas scramble explained', 'https://www.nationalclubgolfer.com/club/texas-scramble-golf-format-explained'],
  ['National Club Golfer: Skins explained', 'https://www.nationalclubgolfer.com/club/skins-golf-format-explained'],
  ['National Club Golfer: Nassau explained', 'https://www.nationalclubgolfer.com/club/nassau-golf-format-explained'],
  ['Golf Digest: How to play Wolf', 'https://www.golfdigest.com/story/golf-game-wolf-betting-gambling-explained'],
  ['Golf Monthly: What is the Snake golf game?', 'https://golfmonthly.com/features/the-game/what-is-the-snake-golf-betting-game-67209'],
  ['Golf Compendium: The 6-Point game explained', 'https://golfcompendium.com/2024/12/blog-post.html'],
]
