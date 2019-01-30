import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ContextualBalloon from "@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon";
import ListView from "@ckeditor/ckeditor5-ui/src/list/listview";
import Collection from "@ckeditor/ckeditor5-utils/src/collection";
import Model from "@ckeditor/ckeditor5-ui/src/model";
import ListItemView from "@ckeditor/ckeditor5-ui/src/list/listitemview";
import ButtonView from "@ckeditor/ckeditor5-ui/src/button/buttonview";
import { downcastElementToElement, downcastAttributeToAttribute } from '@ckeditor/ckeditor5-engine/src/conversion/downcast-converters';
import { upcastElementToElement, upcastAttributeToAttribute } 	from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';
import { toWidget, toWidgetEditable } 				from '@ckeditor/ckeditor5-widget/src/utils';


export default class AutoComplete extends Plugin {
	static get requires() {
		return [ ContextualBalloon];
	}


	init() {
		console.log( 'AutoComplete was initialized' );
		const editor = this.editor;

		this._addConversions(editor);

		/**
		 * The contextual balloon plugin instance.
		 *
		 * @private
		 * @member {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = editor.plugins.get( ContextualBalloon );


		this.model = new Model( {
			text: '',
			suggestions: new Collection( { idProperty: 'label' } )
		} );

		const listModel = new Model( {
			items: this.model.suggestions,
			current: null
		} );

		const suggestions = this.model.suggestions;

		// Show the panel when there are some suggestions.
		this.listenTo( suggestions, 'add', () => {
			console.log("Add suggestions");
			if ( !this._balloon.hasView(this._listUi) ) {
				this._balloon.add( {
					view: this._listUi,
					position: this._getBalloonPositionData()
				} );

			}
		} );

		// Hide the panel when no suggestions.
		this.listenTo( suggestions, 'remove', () => {
			console.log("Remove suggestions");
			if ( !this.model.suggestions.length ) {
				this._balloon.remove(this._listUi);
			}
		} );


		this._listUi = this._setupList(listModel);


		this._listUi.on('execute', (itemModel) => {
			console.log("data from listView", itemModel);
			editor.model.change( writer => {
				const elem = writer.createElement( "autocomplete", {user: itemModel.source.data.id} );
				writer.appendText(itemModel.source.data.text, elem);

				// const insertAtSelection = this.inline? model.document.selection.getFirstPosition()
				//                                      : findOptimalInsertionPosition( model.document.selection, model );

				const insertAtSelection = editor.model.document.selection.getFirstPosition();
				editor.model.insertContent( elem, insertAtSelection );
				this._balloon.remove(this._listUi);

			} );
		});

		editor.model.document.on('change:data', this._check.bind(this) );
	}


	_addConversions(editor) {
		const tag = "autocomplete";
		const attr = {'user': 'user'};
		const editable = false;
		const attrkeys = Object.keys(attr);

		editor.model.schema.register(tag, {
			allowWhere: '$text',
			allowAttributes: attrkeys,
			isObject: true,
			isBlock: true,
		});

		editor.model.schema.extend('$text', {
			allowIn: 'autocomplete'
		});

		//---conversion
		editor.conversion.for('editingDowncast').add(
			editable ?
				downcastElementToElement({
					model: tag,
					view: (modelItem, viewWriter) => {
						const widgetElement = viewWriter.createContainerElement(tag);
						return toWidgetEditable(widgetElement, viewWriter);
					}
				})
				:
				downcastElementToElement({
					model: tag,
					view: (modelItem, viewWriter) => {
						const widgetElement = viewWriter.createContainerElement(tag);
						return toWidget(widgetElement, viewWriter);
					}
				})
		);
		editor.conversion.for('dataDowncast').add(
			downcastElementToElement({
				model: tag,
				view: tag
			})
		);
		editor.conversion.for('upcast').add(
			upcastElementToElement({
				view: tag,
				model: tag
			})
		);

		//attribute conversion
		for (let a = 0; a < attrkeys.length; a++) {
			editor.conversion.for('downcast').add(downcastAttributeToAttribute({
				model: attrkeys[a],
				view: attrkeys[a],
				converterPriority: 'low'
			}));
			editor.conversion.for('upcast').add(upcastAttributeToAttribute({
				view: attrkeys[a],
				model: attrkeys[a],
				converterPriority: 'low'
			}));
		}
	}

	_setupList( listModel ) {
		const editor = this.editor;
		const listView = new ListView();

		listView.items.bindTo( listModel.items ).using((itemModel) => {
			console.log("Items", itemModel);
			/*const item = new ListItemView( editor.locale );

			// Bind all attributes of the model to the item view.
			item.bind( ...Object.keys( itemModel ) ).to( itemModel );*/

			const listItemView = new ListItemView( editor.locale );
			const buttonView = new ButtonView( editor.locale );

			// Bind all model properties to the button view.
			buttonView.bind( ...Object.keys( itemModel ) ).to( itemModel );
			buttonView.delegate( 'execute' ).to( listItemView );

			listItemView.children.add( buttonView );
			return listItemView;
		});

		listView.items.delegate( 'execute' ).to( listView );

		return listView;
	}

	_check(){
		console.log( '[i] Checking autocomplete' );

		const cfg = editor.config.get( 'autocomplete' );

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

		this.model.suggestions.clear();

		for ( let c in cfg ) {
			const index = preceding.lastIndexOf( c );

			if ( index > lastTriggerIndex ) {
				// "A s#ample @te"
				// -----------^
				lastTriggerIndex = index;

				// "@"
				lastTrigger = c;
			}
		}

		console.log( `	[i] Preceding: "${ preceding }"` );

		if ( !lastTrigger ) {
			console.log( '	[i] No trigger found.' );

			return;
		}

		const text =
			// "te"
			selText.slice( lastTriggerIndex, selOffset ) +
			// "xt."
			selText.slice( selOffset ).split( /\s/g )[ 0 ];

		console.log( `	[i] Text: "${ text }"` );

		if ( text.match( /\s/g ) ) {
			console.log( '	[i] Whitespace between trigger and current position.' );

			return;
		}

		this.model.text = text;


		cfg[ lastTrigger ]
			.filter( sugText => {
				if ( text === lastTrigger ) { // Return all
					return sugText;
				} else {
					return sugText !== text && sugText.text.indexOf( text.substr(1) ) === 0;
				}
			} )
			.sort()
			.forEach( sugText => {
				console.log( `	[i] Suggestion "${ sugText.text }" found.` );

				// It's very, very memory-inefficient. But it's a PoC, so...
				this.model.suggestions.add( new Model( {
					label: sugText.text,
					withText: true,
					data : {
						...sugText,
						ref: lastTrigger
					}
				} ) );
			} );
	}

	_getBalloonPositionData() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;

		const target = view.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() );

		return { target };
	}

}
