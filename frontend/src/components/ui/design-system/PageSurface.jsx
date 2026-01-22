/**
 * PageSurface - Canonical Page Content Container
 *
 * Extracted from Knowledge Systems - provides consistent content layout and spacing.
 * Handles max width, padding, and layout rhythm for all page content.
 *
 * DO NOT MODIFY - This matches Knowledge Systems exactly.
 */

/**
 * PageSurface - Standardized page content container
 */
function PageSurface({ children, className = '' }) {
  return (
    <div className={`max-w-6xl mx-auto px-6 pb-12 ${className}`}>
      {children}
    </div>
  );
}

export default PageSurface;