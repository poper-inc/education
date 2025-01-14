import { hot } from 'react-hot-loader'
import * as React from "react";
import { Spin } from "antd";
import { useState, useEffect, Fragment } from 'react';
import { HashRouter as Router, Route } from "react-router-dom";

import AdapterClient from "../modules/Adapter";
import RoomControlStore from "../store/RoomControl";

import LoginPage from "./Login";
import DeviceTestPage from "./DeviceTest";
import ClassroomPage from "./Class";

import { session, createLogger } from "../utils";

if (!process.env.REACT_APP_AGORA_APPID) {
  throw new Error("App ID not set.");
}
const adapter = new AdapterClient(process.env.REACT_APP_AGORA_APPID);

const appLog = createLogger("[App]", "white", "#722ed1", true);

function App() {
  // hooks
  const dispatch = RoomControlStore.getDispatch();

  const [adt, setAdt] = useState(adapter);

  const [needUpdate, setNeedUpdate] = useState(
    !adt.initialized && session.load("adapterConfig")
  );

  const initEngine = (config = session.load("adapterConfig")) => {
    return new Promise((resolve, reject) => {
      if (needUpdate || config) {
        adt
          .initialize(config)
          .then(({ channelAttr, members }) => {
            setNeedUpdate(false);
            adt.signal.on("MemberJoined", (member: any) => {
              dispatch({ type: "addMember", members: member });
            });
            adt.signal.on("MemberLeft", (args: any) => {
              dispatch({ type: "removeMember", uid: args.uid });
            });
            adt.signal.on("UserAttrUpdated", (args: any) => {
              dispatch({
                type: "updateUserAttr",
                uid: args.target,
                userAttr: args.userAttr
              });
            });
            adt.signal.on("ChannelAttrUpdated", (args: any) => {
              let channelAttr = {...args.channelAttr}
              if (channelAttr.shareId) {
                channelAttr.shareId = Number(channelAttr.shareId)
              }
              if (channelAttr.isSharing) {
                channelAttr.isSharing = Number(channelAttr.isSharing)
              }
              dispatch({
                type: "updateChannelAttr",
                channelAttr: channelAttr
              });
            });
            adt.signal.on("ChannelMessage", (args: any) => {
              dispatch({
                type: "addChannelMessage",
                uid: args.uid,
                content: args.message,
                local: args.uid === adt.config.uid
              });
            });
            dispatch({ type: "updateChannelAttr", channelAttr });
            dispatch({ type: "addMember", members });
            setAdt(adt);
            resolve();
          })
          .catch(err => {
            setNeedUpdate(false);
            reject(err);
          });
      } else {
        resolve();
      }
    });
  };

  useEffect(() => {
    if (window.location.hash.length > 2) {
      initEngine();
    }
  }, []);

  // loading mask
  const LoadingMask = (
    <div className="mask-with-bg">
      <Spin size="large" />
    </div>
  );

  const suspenseComponent = (Child: any, props: any) => {
    if (!needUpdate && adt.initialized) {
      return <Child {...props} adapter={adt} initEngine={initEngine} />;
    } else {
      return LoadingMask;
    }
  };

  return (
      <Router>
        <Fragment>
          <Route
            exact
            path="/"
            render={props => (
              <LoginPage {...props} adapter={adt} initEngine={initEngine} />
            )}
          />
          <Route
            path="/device_test"
            render={props => suspenseComponent(DeviceTestPage, props)}
          />
          <Route
            path="/classroom"
            render={props => suspenseComponent(ClassroomPage, props)}
          />
        </Fragment>
      </Router>
  );
}

export default hot(module)(App)
