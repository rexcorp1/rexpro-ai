import React, { useState, useRef, useEffect } from 'react';
import { Model } from '../types';
import { ChevronDown, X } from 'lucide-react';

interface HeaderModelSelectorProps {
  selectedModel: Model | string;
  setSelectedModel: (model: Model | string) => void;
  modelOptions: { value: Model | string; label: string }[];
  isMobile: boolean;
}

export const HeaderModelSelector: React.FC<HeaderModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  modelOptions,
  isMobile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLabel = modelOptions.find(opt => opt.value === selectedModel)?.label || selectedModel;
  
  const renderOptions = () => modelOptions.map(option => (
    <div
      key={option.value}
      onClick={() => {
        setSelectedModel(option.value);
        setIsOpen(false);
      }}
      className={`flex items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-gray-300 cursor-pointer rounded-lg ${
        option.value === selectedModel
          ? 'bg-gray-100 dark:bg-gray-800 font-medium'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      role="option"
      aria-selected={option.value === selectedModel}
    >
      <span className="truncate">{option.label}</span>
    </div>
  ));

  if (isMobile && isOpen) {
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)}></div>
        {/* Bottom Sheet */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-lg z-50 p-4 max-h-[50vh] flex flex-col shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Select a Model</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="h-5 w-5"/>
            </button>
          </div>
          <div className="overflow-y-auto hover-scrollbar space-y-1">
            {renderOptions()}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-[14.5rem] flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && !isMobile && (
        <div className="absolute z-10 top-full mt-1 w-full md:w-[14.5rem] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto hover-scrollbar [scrollbar-gutter:stable]" role="listbox">
          {renderOptions()}
        </div>
      )}
    </div>
  );
};