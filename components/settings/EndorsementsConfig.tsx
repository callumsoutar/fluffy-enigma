"use client";

import { Award } from "lucide-react";

export default function EndorsementsConfig() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Award className="w-12 h-12 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Certifications</h3>
      <p className="text-sm text-gray-500 max-w-md">
        Manage licenses, ratings, and endorsements.
      </p>
    </div>
  );
}

