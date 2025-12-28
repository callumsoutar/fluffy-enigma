"use client";

import { useState } from "react";
import { GraduationCap, Award, FileText, Target, Trophy, BookOpen } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import ExperienceTypesConfig from "./ExperienceTypesConfig";
import SyllabusConfig from "./SyllabusConfig";
import ExamsConfig from "./ExamsConfig";
import LessonsTab from "./LessonsTab";
import EndorsementsConfig from "./EndorsementsConfig";

const trainingTabs = [
  { id: "experience-types", label: "Experience Types", icon: Trophy },
  { id: "training-programs", label: "Training Programs", icon: GraduationCap },
  { id: "lessons", label: "Lessons", icon: BookOpen },
  { id: "exams", label: "Exams", icon: FileText },
  { id: "certifications", label: "Certifications", icon: Award },
  { id: "progress", label: "Progress Tracking", icon: Target },
];

export function TrainingTab() {
  const [selectedTab, setSelectedTab] = useState("experience-types");

  return (
    <div className="w-full h-full">
      <Tabs.Root
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full h-full flex flex-col"
      >
        <Tabs.List
          className="flex flex-row gap-1 mb-8 border-b-2 border-gray-200"
          aria-label="Training configuration types"
        >
          {trainingTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-indigo-50 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-500 hover:text-indigo-600 hover:bg-gray-50 whitespace-nowrap rounded-t-lg -mb-[2px]"
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <div className="flex-1 overflow-auto">
          <Tabs.Content value="experience-types" className="outline-none">
            <ExperienceTypesConfig />
          </Tabs.Content>

          <Tabs.Content value="training-programs" className="outline-none">
            <SyllabusConfig />
          </Tabs.Content>

          <Tabs.Content value="lessons" className="outline-none">
            <LessonsTab />
          </Tabs.Content>

          <Tabs.Content value="exams" className="outline-none">
            <ExamsConfig />
          </Tabs.Content>

          <Tabs.Content value="certifications" className="outline-none">
            <EndorsementsConfig />
          </Tabs.Content>

          <Tabs.Content value="progress" className="outline-none">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Progress Tracking</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Configure how student progress is tracked and reported. This feature is coming soon.
              </p>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
