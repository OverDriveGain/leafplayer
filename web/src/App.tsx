import React, { ReactElement } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import Login from './views/Login';
import {
  AuthenticatedRoute,
  AuthProvider,
  NotWhenAuthorizedRoute,
} from './modules/auth';
import Wrapper from './components/Wrapper/Wrapper';
import Register from './views/Register';
import Download from './views/Download';
import { NotificationProvider } from 'modules/notifications/NotificationProvider';
import { ThemeProvider } from 'modules/theming/ThemeProvider';

function App(): ReactElement {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <Router>
            <Switch>
              <NotWhenAuthorizedRoute exact path="/login" component={Login} />
              <NotWhenAuthorizedRoute
                exact
                path="/register"
                component={Register}
              />
              <AuthenticatedRoute exact path="/download" component={Download} />
              <AuthenticatedRoute path="/" component={Wrapper} />
              <Route render={() => <span>404 Not found</span>}></Route>
            </Switch>
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
