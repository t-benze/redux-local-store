/**
 * Created by tangbz on 3/31/17.
 */


import React, { PureComponent, PropTypes, createElement } from "react";
import { connect } from "react-redux";

import invariant from "invariant";

import {
    discardLocalStore,
    registerLocalStore,
    dispatchLocalAction,
} from "./actions";

import getLocalStoreId from './localStoreId';
import {getLocalStore} from './reducer';


export default function connectLocal(mapStateToProps, mapDispatchToProps, mergeProps, localStoreConfig, connectOptions = {}) {
    const localMapStateToProps = localStoreConfig.mapStateToProps || (() => ({}));

    function modifiedMapStateToProps(state, props) {
        const globalStateProps = mapStateToProps(state, props);

        const localStore = getLocalStore(state, props.$$localStoreId);

        const localStateProps = localMapStateToProps(localStore.state, props);
        return {
            ...globalStateProps,
            ...localStateProps
        };
    };

    const { storeKey = 'store', getDisplayName = name => `ConnectLocal${name}` } = connectOptions;
    const contextTypes = {
        [storeKey]: PropTypes.object,
    }

    return function wrapWithLocalConnect(WrappedComponent) {
        invariant(
            typeof WrappedComponent == 'function',
            `You must pass a component to the function returned by ` +
            `connectLocal. Instead received ${JSON.stringify(WrappedComponent)}`
        )

        const wrappedComponentName = WrappedComponent.displayName ||
            WrappedComponent.name ||
            'Component'

        const displayName = getDisplayName(wrappedComponentName);

        const ConnectedComponent = connect(
            modifiedMapStateToProps,
            mapDispatchToProps,
            mergeProps,
            connectOptions,
        )(WrappedComponent);

        class LocalConnect extends PureComponent {
            constructor(props, context) {
                super(props);
                this.state = {
                    isLocalStoreReady: false
                }
                this.localStoreId = getLocalStoreId();
                this.store = props[storeKey] || context[storeKey];

                invariant(this.store,
                    `Could not find "${storeKey}" in either the context or props of ` +
                    `"${displayName}". Either wrap the root component in a <Provider>, ` +
                    `or explicitly pass "${storeKey}" as a prop to "${displayName}".`
                )

                this.unsubscribe = this.store.subscribe(() => {
                    const state = this.store.getState();
                    if (getLocalStore(state, this.localStoreId)) {
                        this.setState({
                            isLocalStoreReady: true
                        });
                        this.unsubscribe();

                    }
                })
            }

            componentWillMount() {
                this.store.dispatch(registerLocalStore(this.localStoreId, localStoreConfig.reducer));
            }

            componentWillUnmount() {
                setTimeout(() => {
                    this.store.dispatch(discardLocalStore(this.localStoreId));
                })
            }

            render() {
                if (this.state.isLocalStoreReady) {
                    return createElement(ConnectedComponent, {$$localStoreId: this.localStoreId})
                } else {
                    return null;
                }
            }
        }

        LocalConnect.contextTypes = {
            [storeKey]: PropTypes.object,
        }
        return LocalConnect;
    }
}