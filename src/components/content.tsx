import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

// Only text formatting is allowed, including <u> for the underline button.
// No images, scripts, styles, event handlers, embedded pages, or arbitrary attributes.
const schema = {
  tagNames: ["p", "br", "strong", "em", "u", "del", "s", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "a", "hr"],
  attributes: { a: ["href", "title"], ol: ["start"] },
  protocols: { href: ["http", "https", "mailto"] },
};

export function Content({ text }: { text: string }) {
  return <div className="prose"><Markdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
    components={{
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      a: ({ href, children, title }) => href ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    }}
  >{text}</Markdown></div>;
}
