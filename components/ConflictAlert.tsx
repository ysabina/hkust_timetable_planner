'use client';
import { AlertCircle } from 'lucide-react';
import type { Conflict } from '../lib/types';

interface ConflictAlertProps {
  conflicts: Conflict[];
}

export default function ConflictAlert({ conflicts }: ConflictAlertProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="max-w-[1800px] mx-auto px-6 pt-4">
      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/50 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-100 mb-2">
              Time Conflicts Detected
            </h3>
            <div className="space-y-1">
              {conflicts.map((conflict, index) => (
                <p key={index} className="text-sm text-red-200/90">
                  <span className="font-medium">{conflict.course1}</span> ({conflict.section1}) 
                  {' '}conflicts with{' '}
                  <span className="font-medium">{conflict.course2}</span> ({conflict.section2})
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
