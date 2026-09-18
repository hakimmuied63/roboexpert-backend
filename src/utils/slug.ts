export const slugify = (text: string): string => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };
  
  export const uniqueSlug = async (
    base: string,
    exists: (slug: string) => Promise<boolean>
  ): Promise<string> => {
    let slug = base;
    let counter = 1;
  
    while (await exists(slug)) {
      slug = `${base}-${counter}`;
      counter++;
    }
  
    return slug;
  };