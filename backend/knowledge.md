# Code Organization Rules

## File Size and Organization

1. **Maximum File Size**
   - Keep files under 300 lines
   - Split by domain/feature when approaching limit
   - Extract shared utilities

2. **File Organization**
   - Group related functionality in directories
   - Use index.js files for exports
   - Keep imports at top, organized by type

3. **Code Structure**
   - One feature/domain per file
   - Extract complex logic to utilities
   - Use composition over inheritance
   - Keep functions focused and small

4. **Naming Conventions**
   - Use descriptive, domain-specific names
   - Group related files with common prefixes
   - Suffix utilities with their purpose

5. **Directory Structure**
   ```
   feature/
   ├── index.js           # Main exports
   ├── feature-core.js    # Core logic
   ├── feature-types.js   # Type definitions
   └── utils/
       ├── helpers.js     # Shared helpers
       └── constants.js   # Constants
   ```

## Best Practices

1. **Command Pattern**
   - Split complex commands into subcommands
   - Group related commands in modules
   - Share utilities between commands
   - Keep command handlers focused

2. **Error Handling**
   - Consistent error messages
   - Proper error propagation
   - User-friendly output
   - Debug information when needed

3. **Testing**
   - Test files in isolation
   - Mock external dependencies
   - Verify error cases
   - Check edge conditions

4. **Documentation**
   - Document file purpose
   - Add example usage
   - Note dependencies
   - Explain complex logic

## When to Split Files

Split a file when it:
- Exceeds 300 lines
- Handles multiple features
- Has complex logic
- Needs different testing strategies

## How to Split Files

1. Identify logical boundaries
2. Extract shared utilities
3. Create focused modules
4. Use index.js for exports
5. Update imports
6. Test thoroughly