"use client";

import * as React from "react";
import Image from "next/image";
import { IconX, IconPhoto } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
  disabled?: boolean;
  currentFile?: string | null; // URL of current file for preview
  label?: string;
}

export function Dropzone({
  onFileSelect,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  className,
  disabled = false,
  currentFile,
  label = "Drop files here or click to upload",
}: DropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Set preview from currentFile prop
  React.useEffect(() => {
    if (currentFile) {
      setPreview(currentFile);
    }
  }, [currentFile]);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
    }

    if (accept && accept.includes("image/")) {
      if (!file.type.startsWith("image/")) {
        return "Only image files are allowed";
      }
    }

    return null;
  };

  const handleFile = (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Call onFileSelect with null to indicate removal
    onFileSelect(null);
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer",
          isDragging && !disabled
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 hover:border-slate-400",
          disabled && "opacity-50 cursor-not-allowed",
          preview && "p-2"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {preview ? (
          <div className="relative group">
            <div className="relative w-full h-48 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <IconX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-slate-100 mb-3">
              <IconPhoto className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">
              {label}
            </p>
            <p className="text-xs text-slate-500">
              PNG, JPG, GIF up to {(maxSize / 1024 / 1024).toFixed(1)}MB
            </p>
          </div>
        )}

        {error && (
          <div className="mt-2 text-sm text-red-600 text-center">{error}</div>
        )}
      </div>
    </div>
  );
}
