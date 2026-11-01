// Official 0.18.1 actions and RoughJS rendering, scoped to temporary ink only.
export function presentationStyles() {
  const sites = new Set();
  return {
    name: 'local-canvas-presentation-styles',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@excalidraw/excalidraw/dist/prod/')) return;
      let next = code;
      if (id.endsWith('/index.js')) {
        const controls = '(Km(e.activeTool.type)||n.some(h=>Km(h.type)))&&';
        const create =
          'c=rx({type:r,x:i,y:a,strokeColor:this.state.currentItemStrokeColor';
        if (!next.includes(controls) || !next.includes(create))
          throw Error(
            'Presentation native actions/creation adapter did not match',
          );
        next = next.replace(
          controls,
          '(Km(e.activeTool.type)||n.some(h=>Km(h.type))||r.props.name==="Local Canvas presentation ink")&&',
        );
        next = next.replace(
          create,
          'c=rx({customData:this.props.name==="Local Canvas presentation ink"?{localCanvasPresentationInk:true}:void 0,type:r,x:i,y:a,strokeColor:this.state.currentItemStrokeColor',
        );
        sites.add('actions');
      } else if (
        next.includes('case"freedraw":{let i;if(V1(e),Kt(e.points))')
      ) {
        next = next.replace(
          'case"freedraw":{let i;if(V1(e),Kt(e.points))',
          'case"freedraw":{if(e.customData?.localCanvasPresentationInk){V1(e);return e.points.length>1?t.curve(Ym(e.points,.75),rt(e)):null}let i;if(V1(e),Kt(e.points))',
        );
        const render = 'n.fillStyle=e.strokeColor,n.fill(i),n.restore();break';
        if (!next.includes(render))
          throw Error('Presentation native canvas adapter did not match');
        next = next.replace(
          render,
          'n.fillStyle=e.strokeColor,e.customData?.localCanvasPresentationInk||n.fill(i),n.restore();break',
        );
        sites.add('render');
      }
      if (next !== code) return { code: next, map: null };
    },
    buildEnd(error) {
      if (!error && sites.size !== 2)
        throw Error('Presentation style adapter incomplete');
    },
  };
}
