import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import ContextualBalloon from "@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon";
import Highlight from "@ckeditor/ckeditor5-highlight/src/highlight";

export default class HTOP extends Plugin {
	static get requires() {
		return [Highlight];
	}

	init(){

		console.log('HTOP plugin started');
		const editor = this.editor;
		editor.model.document.on('change:data', this._check.bind(this) );
	}

	_check(){
		console.log( '[i] Checking HTP' );
		const trigger = '#top';

		const editor = this.editor;
		const sel = editor.model.document.selection;

		let originalText = '';
		for ( const child of sel.focus.parent.getChildren() ) {
			if ( child.is( 'text' ) ) {
				originalText += child.data;
			}
		}
		const selText = originalText;
		const selOffset = sel.focus.offset;

		// "A s#ample @te"
		const preceding = selText.substr( 0, selOffset );

		let lastTrigger = null;
		let lastTriggerIndex = -1;

		console.log(lastTriggerIndex, preceding);
		const index = preceding.lastIndexOf( trigger );

		if ( index > lastTriggerIndex ) {
			// "A s#ample @te"
			// -----------^
			lastTriggerIndex = index;

			// "@"
			lastTrigger = trigger;
		}

		console.log( `	[i] Preceding: "${ preceding }"` );

		if ( !lastTrigger ) {
			console.log( '	[i] No trigger found.' );

			return;
		}

		editor.model.change(writer => {
			const range = writer.createRangeIn(sel.focus.parent);
			writer.setAttribute( 'highlight', 'yellowMarker', range );
		});

		console.log("Detected");
	}
}
