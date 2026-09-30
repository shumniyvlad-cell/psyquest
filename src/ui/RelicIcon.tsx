import { Cog, Compass, Droplet, Gem, Hammer, Megaphone, Shield, Waves } from 'lucide-react'
import type { RelicId } from '../game/items'

const ICONS = {
  shield_facts: Shield,
  compass: Compass,
  hammer: Hammer,
  gear: Cog,
  crystal_echo: Gem,
  horn: Megaphone,
  calm_voice: Waves,
  lantern_oil: Droplet,
} satisfies Record<RelicId, unknown>

export function RelicIcon({ id, size = 22 }: { id: RelicId; size?: number }) {
  const I = ICONS[id]
  return (
    <span className="relic-icon" style={{ width: size + 18, height: size + 18 }}>
      <I size={size} strokeWidth={1.6} />
    </span>
  )
}
