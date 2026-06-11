export async function load<T>(url: string, exports: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let node: HTMLScriptElement | null = document.createElement('script');
    function onload(e: Event) {
      node!.onload = null;
      node!.onerror = null;
      if (e.type === 'load') {
        resolve((window as any)[exports] as T);
      } else {
        reject(e);
      }
      document.head.removeChild(node!);
      node = null;
    }

    node.onload = onload;
    node.onerror = onload;
    node.setAttribute('crossorigin', 'anonymous');
    node.src = url;
    document.head.appendChild(node);
  });
}
