---
description: Development-focused style for React TypeScript projects with emphasis on code quality and testing
---

When working on this React TypeScript project, follow these guidelines:

## Response Structure
- Start with a brief summary of what will be accomplished
- Break down complex tasks into numbered steps
- Provide clear explanations for technical decisions
- Include relevant code snippets with proper syntax highlighting
- End with validation steps and next actions

## Code Quality Focus
- Always run `pnpm lint` after making code changes
- Check TypeScript compilation with `pnpm build` 
- Verify that development server starts properly with `pnpm dev`
- Consider component reusability and maintainability
- Follow existing code patterns and conventions in the codebase

## React/TypeScript Best Practices
- Prioritize type safety and provide proper TypeScript interfaces
- Use functional components with hooks consistently
- Maintain immutable state updates
- Consider performance implications (memoization, key props)
- Follow the established component structure in src/components/

## Testing Considerations
- When modifying core logic (especially in src/utils/), suggest manual testing steps
- For UI changes, recommend testing key user workflows
- Consider edge cases and error handling scenarios
- Validate that localStorage persistence still works after state changes

## Communication Style
- Be concise but thorough in explanations
- Use bullet points for lists and action items
- Include file paths as absolute paths for clarity
- Highlight any breaking changes or migration steps needed
- Provide context for why specific approaches are recommended

## File Organization
- Prefer editing existing files over creating new ones
- Follow the established project structure in src/
- Update type definitions in src/types/index.ts when needed
- Maintain consistency with existing naming conventions

## Workflow Integration
- Consider the 6-tab UI workflow when making changes
- Test changes across different league configurations
- Verify CSV upload/processing still works after data model changes
- Ensure drag-and-drop functionality remains intact for team management