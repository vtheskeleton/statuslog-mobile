import { StatusBar } from 'expo-status-bar';
import {Button, StyleSheet, Text, View} from 'react-native';
import {BottomTabNavigationOptions, createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from "@react-navigation/native";
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import React, {useEffect} from "react";

const Tab = createBottomTabNavigator();
const MainContext = React.createContext(undefined);

// Omgoauth
const discovery = {
	authorizationEndpoint: 'https://home.omg.lol/oauth/authorize',
	tokenEndpoint: 'https://api.omg.lol/oauth/token',
	revocationEndpoint: undefined,
};

async function saveAPIkey(value) {
	await SecureStore.setItemAsync("omgalol_apikey", JSON.stringify(value));
}
async function loadAPIkey() {
	return JSON.parse(await SecureStore.getItemAsync("omgalol_apikey"));
}

const HomeScreen = () => {
	let [getKey, setKey] = React.useContext(MainContext);
	return (
		<View style={styles.container}>
			<Text style={{color: "#FFF"}}>Statusing your lol</Text>
			<Text style={{color: "#FFF"}}>API Key: {getKey}</Text>
			<StatusBar style="auto" />
		</View>
	);
}

const SettingsScreen = () => {
	let [getKey, setKey] = React.useContext(MainContext);
	return (
		<View style={styles.container}>
			<Text>Settings Screen</Text>
			<Button title={"Log out"} onPress={() => {setKey(undefined);saveAPIkey("")}} />
			<StatusBar style="auto" />
		</View>
	);
}

const SigninScreen = () => {
	let [getKey, setKey] = React.useContext(MainContext);
	const [request, response, promptAsync] = useAuthRequest(
		{
			clientId: 'addea4ef423ef2cf51cefb4d824a3356',
			scopes: ['everything'],
			redirectUri: makeRedirectUri({ path: "/callback"}),
		},
		discovery
	);

	useEffect(() => {
		if (response?.type === 'success') {
			const { code } = response.params;
			fetch("https://appauth.skelly.omg.lol/", {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					"code": code,
				})
			}).then(res => res.text()).then(token => {
				saveAPIkey(token);
				setKey(token);
			})
		}
	}, [response]);

	return (
		<View style={styles.container}>
			<Text style={{color: "#ffe066", fontWeight: "bold", marginBottom: 10}}>To post a status you must log in</Text>
			<Button disabled={!request} title={"Sign in with OMG.LOL"} color="#c2255c" onPress={() => {promptAsync()}} />
			<StatusBar style="auto" />
		</View>
	);
}

export default function App() {
	let [getKey, setKey] = React.useState(undefined);
	let [getLoaded, setLoaded] = React.useState(false);


	useEffect(() => {
		loadAPIkey().then((value: object | undefined) => {
			if (value) setKey(value);
			setLoaded(true);
		});
	}, [setKey, setLoaded])


	if (!getLoaded) return <View style={styles.container}><Text style={{color: "#FFF"}}>Statusing your lol... (loading)</Text></View>;

	return (
		<MainContext.Provider value={[getKey, setKey]}>
			<NavigationContainer>
				<Tab.Navigator screenOptions={screenOptions}>
					{getKey !== undefined ? [(
							<Tab.Screen key={"0"} name="Home"
							            options={{
								            tabBarIcon: ({focused, color, size}) => (<Ionicons name="chatbubble" size={size} color={color}/>)
							            }}
							            component={HomeScreen}
							/>
					),(
							<Tab.Screen key={"1"} name="Settings"
							            options={{
								            tabBarIcon: ({focused, color, size}) => (<Ionicons name="cog" size={size} color={color}/>)
							            }}
							            component={SettingsScreen}
							/>
					)] : (
						<Tab.Screen name="Sign in"
						            options={{
							            tabBarIcon: ({focused, color, size}) => (<Ionicons name="key-outline" size={size} color={color}/>)
						            }}
						            component={SigninScreen}
						/>
					)}


				</Tab.Navigator>
			</NavigationContainer>
		</MainContext.Provider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#343a40',
		alignItems: 'center',
		justifyContent: 'center',
	},
});

const activeColor : string = '#339af0';
const inactiveColor : string = '#d0ebff';

const screenOptions : BottomTabNavigationOptions = {
	tabBarActiveTintColor: activeColor,
	tabBarInactiveTintColor: inactiveColor,
	tabBarStyle: {
		backgroundColor: "#212529",
		borderTopWidth: 0
	},
	headerStyle: {
		backgroundColor: "#212529",
		borderBottomWidth: 0
	},
	headerTitleStyle: {
		color: "#1971c2",
		fontWeight: "bold"
	}
}