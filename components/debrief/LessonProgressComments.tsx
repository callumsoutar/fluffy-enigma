"use client"

import React from "react"

interface LessonProgressCommentsProps {
  comments: string | null | undefined
}

export default function LessonProgressComments({ comments }: LessonProgressCommentsProps) {
  if (!comments) {
    return <p className="text-gray-500 italic">No comments recorded.</p>
  }

  // Sanitize HTML to allow only safe tags (p, br, strong, em, ul, ol, li, etc.)
  const sanitizeHTML = (html: string | null): string => {
    if (!html) return ""
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Remove object and embed tags
    sanitized = sanitized.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, "")
    // Remove on* event handlers from remaining tags
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    return sanitized
  }

  return (
    <div 
      className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeHTML(comments) }}
    />
  )
}
