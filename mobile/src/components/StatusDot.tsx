import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme/colors';

type Status = 'in_range' | 'out_of_range' | 'warning';

const statusColors: Record<Status, string> = {
  in_range: colors.success,
  out_of_range: colors.danger,
  warning: colors.warning,
};

export function StatusDot({ status }: { status: Status }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: statusColors[status] || colors.text.muted,
      }}
    />
  );
}
