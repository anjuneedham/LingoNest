import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { SKILLS, cefrOrdinal, type Cefr, type Skill } from '@lingonest/core';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface SkillRadarProps {
  readonly levels: Partial<Record<Skill, Cefr | null>>;
  readonly size?: number;
  /** Skills to plot; defaults to the six the learner sees most. */
  readonly skills?: readonly Skill[];
}

const DEFAULT_SKILLS: readonly Skill[] = [
  'listening',
  'reading',
  'speaking',
  'writing',
  'grammar',
  'vocabulary',
];

/** C2 is the top of the scale, so 60 is the maximum ordinal. */
const MAX_ORDINAL = 60;

/**
 * The nine-skill picture, drawn as a radar.
 *
 * The shape is the point: an uneven profile — strong reading, weak writing —
 * is what makes the app's advice specific, so it is shown rather than averaged
 * away into one number.
 */
export function SkillRadar({ levels, size = 220, skills = DEFAULT_SKILLS }: SkillRadarProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const centre = size / 2;
  const radius = size / 2 - 34;
  const count = skills.length;

  const pointFor = (index: number, fraction: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: centre + Math.cos(angle) * radius * fraction,
      y: centre + Math.sin(angle) * radius * fraction,
    };
  };

  const values = skills.map((skill) => {
    const level = levels[skill];
    return level ? cefrOrdinal(level) / MAX_ORDINAL : 0;
  });

  const polygon = values
    .map((value, index) => {
      const point = pointFor(index, Math.max(0.06, value));
      return `${point.x},${point.y}`;
    })
    .join(' ');

  const assessed = values.filter((v) => v > 0).length;

  return (
    <View accessible accessibilityLabel={t('skills.radarLabel')}>
      <Svg width={size} height={size}>
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <Circle
            key={ring}
            cx={centre}
            cy={centre}
            r={radius * ring}
            stroke={theme.border}
            strokeWidth={1}
            fill="none"
          />
        ))}

        {skills.map((skill, index) => {
          const edge = pointFor(index, 1);
          return (
            <Line
              key={skill}
              x1={centre}
              y1={centre}
              x2={edge.x}
              y2={edge.y}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}

        {assessed > 0 ? (
          <Polygon points={polygon} fill={theme.primary} fillOpacity={0.25} stroke={theme.primary} strokeWidth={2} />
        ) : null}

        {skills.map((skill, index) => {
          const label = pointFor(index, 1.24);
          return (
            <SvgText
              key={`label-${skill}`}
              x={label.x}
              y={label.y}
              fontSize={11}
              fill={theme.textMuted}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {t(`skills.${skill}`)}
            </SvgText>
          );
        })}
      </Svg>

      {assessed === 0 ? (
        <Text variant="caption" color="muted" align="center">
          {t('skills.noEvidenceYet')}
        </Text>
      ) : null}
    </View>
  );
}
