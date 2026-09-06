import React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { SpeciesId } from '@/data/species';

/**
 * Field Guide portraits.
 *
 * Flat, layered shapes rather than photorealism — the same construction
 * technique across all four (a body block, a head accent, one or two
 * signature features) so the cast reads as one family despite each species
 * looking nothing alike.
 */
interface CreatureProps {
  readonly size?: number;
}

export function DoctorBirdIllustration({ size = 120 }: CreatureProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="docBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#4ADE80" />
          <Stop offset="100%" stopColor="#15803D" />
        </LinearGradient>
      </Defs>
      <Path d="M118 150 C 100 190, 70 205, 40 236" fill="none" stroke="#0F172A" strokeWidth={5} strokeLinecap="round" />
      <Path d="M128 150 C 130 192, 108 212, 86 238" fill="none" stroke="#0F172A" strokeWidth={5} strokeLinecap="round" />
      <Path d="M126 96 C 168 84, 190 96, 196 118 C 172 122, 142 118, 126 106 Z" fill="#166534" opacity={0.35} />
      <Path d="M120 92 C 158 76, 182 84, 190 104 C 164 110, 136 108, 118 100 Z" fill="#15803D" opacity={0.85} />
      <Path
        d="M70 118 C 66 92, 84 72, 112 70 C 138 68, 150 88, 148 108 C 146 128, 128 148, 108 150 C 88 152, 74 138, 70 118 Z"
        fill="url(#docBody)"
      />
      <Path d="M78 84 C 86 68, 108 62, 122 68 C 112 78, 96 82, 82 92 Z" fill="#0F172A" />
      <Circle cx={94} cy={86} r={5.5} fill="#0F172A" />
      <Circle cx={92.5} cy={84.5} r={1.6} fill="#F8FAFC" />
      <Path d="M68 96 C 50 94, 34 92, 20 90 C 34 98, 50 104, 68 104 Z" fill="#EA580C" />
      <Path d="M20 90 L 30 92 L 20 96 Z" fill="#0F172A" />
    </Svg>
  );
}

export function QuetzalIllustration({ size = 120 }: CreatureProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="quetzalBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#047857" />
        </LinearGradient>
      </Defs>
      {/* trailing tail streamers */}
      <Path d="M124 140 C 150 168, 158 200, 142 232" fill="none" stroke="#059669" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
      <Path d="M112 142 C 128 176, 128 208, 108 236" fill="none" stroke="#10B981" strokeWidth={7} strokeLinecap="round" />
      <Path d="M100 140 C 104 174, 96 204, 78 228" fill="none" stroke="#059669" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
      {/* wing */}
      <Path d="M132 96 C 168 92, 186 108, 186 128 C 162 128, 140 118, 128 104 Z" fill="#065F46" opacity={0.75} />
      {/* body */}
      <Path
        d="M74 108 C 70 82, 90 64, 116 64 C 142 64, 156 84, 152 108 C 150 128, 134 148, 112 150 C 92 150, 78 130, 74 108 Z"
        fill="url(#quetzalBody)"
      />
      {/* red breast */}
      <Path d="M92 122 C 96 138, 108 148, 118 148 C 110 132, 100 122, 92 122 Z" fill="#DC2626" />
      {/* crest */}
      <Path d="M92 68 C 96 56, 104 50, 112 48 C 108 58, 104 66, 100 74 Z" fill="#047857" />
      <Path d="M104 64 C 110 54, 118 50, 126 50 C 120 58, 114 66, 108 72 Z" fill="#047857" />
      {/* eye + bill */}
      <Circle cx={100} cy={82} r={5} fill="#0F172A" />
      <Circle cx={98.5} cy={80.5} r={1.4} fill="#F8FAFC" />
      <Path d="M76 90 C 64 88, 54 88, 46 90 C 54 96, 66 98, 76 96 Z" fill="#FBBF24" />
    </Svg>
  );
}

export function RedCrownedCraneIllustration({ size = 120 }: CreatureProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      {/* legs */}
      <Path d="M108 172 L 100 224" stroke="#94A3B8" strokeWidth={5} strokeLinecap="round" />
      <Path d="M124 174 L 132 226" stroke="#94A3B8" strokeWidth={5} strokeLinecap="round" />
      {/* wingtip (black) */}
      <Path d="M92 108 C 76 122, 72 142, 84 160 C 100 150, 108 130, 104 110 Z" fill="#0F172A" opacity={0.9} />
      {/* body */}
      <Ellipse cx={108} cy={122} rx={38} ry={46} fill="#F8FAFC" />
      <Ellipse cx={108} cy={122} rx={38} ry={46} fill="none" stroke="#CBD5E1" strokeWidth={1.5} />
      {/* neck */}
      <Path d="M118 86 C 132 66, 138 48, 128 30" fill="none" stroke="#F8FAFC" strokeWidth={20} strokeLinecap="round" />
      <Path d="M118 86 C 132 66, 138 48, 128 30" fill="none" stroke="#0F172A" strokeWidth={20} strokeLinecap="round" opacity={0.14} />
      {/* neck black stripe */}
      <Path d="M124 44 C 130 52, 132 62, 128 72" fill="none" stroke="#0F172A" strokeWidth={9} strokeLinecap="round" />
      {/* head + crown */}
      <Circle cx={130} cy={26} r={13} fill="#F8FAFC" />
      <Circle cx={130} cy={20} r={6} fill="#DC2626" />
      <Circle cx={135} cy={28} r={2.2} fill="#0F172A" />
      <Path d="M141 28 L 156 30 L 141 34 Z" fill="#334155" />
    </Svg>
  );
}

export function AlpineIbexIllustration({ size = 120 }: CreatureProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="ibexBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#A8A29E" />
          <Stop offset="100%" stopColor="#78716C" />
        </LinearGradient>
      </Defs>
      {/* legs */}
      <Path d="M84 168 L 80 214" stroke="#57534E" strokeWidth={7} strokeLinecap="round" />
      <Path d="M104 170 L 100 216" stroke="#57534E" strokeWidth={7} strokeLinecap="round" />
      <Path d="M132 168 L 138 214" stroke="#78716C" strokeWidth={7} strokeLinecap="round" />
      <Path d="M150 166 L 158 212" stroke="#78716C" strokeWidth={7} strokeLinecap="round" />
      {/* horn */}
      <Path
        d="M144 78 C 172 66, 190 42, 188 14 C 178 34, 160 48, 138 56"
        fill="none"
        stroke="#44403C"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Path d="M158 66 L 166 60 M 168 52 L 176 46 M 178 38 L 185 32" stroke="#292524" strokeWidth={3} strokeLinecap="round" />
      {/* body */}
      <Ellipse cx={112} cy={132} rx={54} ry={34} fill="url(#ibexBody)" />
      {/* belly patch */}
      <Ellipse cx={104} cy={152} rx={30} ry={14} fill="#E7E5E4" opacity={0.85} />
      {/* head */}
      <Path
        d="M148 100 C 160 92, 168 90, 176 92 C 170 104, 160 112, 148 116 C 144 110, 144 104, 148 100 Z"
        fill="#A8A29E"
      />
      <Circle cx={162} cy={100} r={3.2} fill="#0F172A" />
      {/* beard */}
      <Path d="M148 116 C 146 124, 146 130, 150 136" stroke="#57534E" strokeWidth={4} strokeLinecap="round" />
      {/* tail */}
      <Path d="M58 122 C 48 120, 42 124, 40 132" stroke="#57534E" strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

export function CreatureIllustration({ id, size }: { id: SpeciesId; size?: number }) {
  switch (id) {
    case 'doctor-bird':
      return <DoctorBirdIllustration size={size} />;
    case 'quetzal':
      return <QuetzalIllustration size={size} />;
    case 'red-crowned-crane':
      return <RedCrownedCraneIllustration size={size} />;
    case 'alpine-ibex':
      return <AlpineIbexIllustration size={size} />;
  }
}
