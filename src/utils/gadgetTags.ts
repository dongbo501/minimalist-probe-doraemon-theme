/**
 * 为节点分配不重复的哆啦A梦道具标签。
 * 优先使用最常见的道具，其余道具按会话随机打乱；节点数超过道具数时循环使用并追加编号。
 */
export const PRIORITY_GADGETS = [
  '竹蜻蜓',
  '任意门',
  '时光机',
  '记忆面包',
  '翻译魔芋',
  '缩小灯',
  '放大灯',
  '空气炮',
  '时光包袱皮',
  '如果电话亭',
] as const

export const EXTRA_GADGETS = [
  '穿透环',
  '复制镜',
  '石头帽',
  '美味桌巾',
  '动物变身饼干',
  '进化退化放射线源',
  '传真布',
  '隐身斗篷',
  '天气箱',
  '模型制作机',
  '真心话领带',
  '魔法水杯',
  '时光电视',
  '心情转换器',
  '梦境遥控器',
  '四次元垃圾桶',
] as const

let sessionSeed: number | null = null

function getSessionSeed(): number {
  if (sessionSeed !== null)
    return sessionSeed

  const random = new Uint32Array(1)
  globalThis.crypto?.getRandomValues?.(random)
  sessionSeed = random[0] || Date.now()
  return sessionSeed
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function assignUniqueGadgets(nodeIds: string[]): Map<string, string> {
  const sortedNodeIds = [...new Set(nodeIds)].sort((a, b) => a.localeCompare(b))
  const extras: string[] = [...EXTRA_GADGETS]
  const random = createRandom(getSessionSeed())

  for (let index = extras.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    const current = extras[index]!
    extras[index] = extras[target]!
    extras[target] = current
  }

  const gadgets = [...PRIORITY_GADGETS, ...extras]

  return new Map(sortedNodeIds.map((nodeId, index) => {
    const round = Math.floor(index / gadgets.length)
    const name = gadgets[index % gadgets.length]!
    return [nodeId, round > 0 ? `${name} ${round + 1}号` : name]
  }))
}
