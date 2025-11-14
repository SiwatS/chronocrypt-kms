/**
 * Metric Card Component
 *
 * Displays a single metric with icon, value, details, and footer
 */

import React from 'react';

export interface MetricCardProps {
  icon: string;
  title: string;
  value: number | string;
  details: Array<{
    label: string;
    value: number | string;
  }>;
  footer: string;
}

export function MetricCard({ icon, title, value, details, footer }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-details">
        {details.map((detail, index) => (
          <div key={index} className="metric-detail">
            <span className="detail-label">{detail.label}:</span>
            <span className="detail-value">{detail.value}</span>
          </div>
        ))}
      </div>
      <div className="metric-footer">{footer}</div>
    </div>
  );
}
